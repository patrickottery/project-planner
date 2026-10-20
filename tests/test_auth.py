"""Cloudflare Access JWT verification with a locally generated key — no network."""
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.exceptions import PyJWKClientConnectionError

from app.auth import auth_mode, read_auth_config
from conftest import make_app

TEAM = "example.cloudflareaccess.com"
AUD = "test-aud"
OWNER = "owner@example.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _Key:
    def __init__(self, key):
        self.key = key


class LocalJWKS:
    def get_signing_key_from_jwt(self, token):
        return _Key(KEY.public_key())


class DownJWKS:
    def get_signing_key_from_jwt(self, token):
        raise PyJWKClientConnectionError("unreachable")


def token(key=KEY, alg="RS256", **over):
    claims = {"aud": AUD, "iss": f"https://{TEAM}", "email": OWNER,
              "iat": int(time.time()), "exp": int(time.time()) + 300}
    claims.update(over)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg)


JWT_ENV = {"CF_ACCESS_AUD": AUD, "CF_ACCESS_TEAM_DOMAIN": f"https://{TEAM}/", "OWNER_EMAIL": OWNER, "APP_ENV": "prod"}


@pytest.fixture
def jwt_client(tmp_path):
    return make_app(tmp_path, JWT_ENV, CF_ACCESS_JWKS_CLIENT=LocalJWKS()).test_client()


def get(client, tok=None, path="/api/v1/projects"):
    return client.get(path, headers={"Cf-Access-Jwt-Assertion": tok} if tok else {})


def test_valid_owner_token(jwt_client):
    assert get(jwt_client, token(email="Owner@Example.com")).status_code == 200


def test_health_is_public(jwt_client):
    assert jwt_client.get("/health").status_code == 200


@pytest.mark.parametrize("bad", [
    None,
    "garbage",
    "WRONG_KEY",
    "WRONG_AUD",
    "WRONG_ISS",
    "EXPIRED",
    "NO_EXP",
    "STRANGER",
    "NO_EMAIL",
    "HS256",
])
def test_bad_tokens_are_403(jwt_client, bad):
    tok = {
        None: None,
        "garbage": "not.a.jwt",
        "WRONG_KEY": token(key=OTHER_KEY),
        "WRONG_AUD": token(aud="other"),
        "WRONG_ISS": token(iss="https://evil.cloudflareaccess.com"),
        "EXPIRED": token(exp=int(time.time()) - 60),
        "NO_EXP": token(exp=None),
        "STRANGER": token(email="stranger@example.com"),
        "NO_EMAIL": token(email=None),
        "HS256": token(key="x" * 32, alg="HS256"),
    }[bad]
    assert get(jwt_client, tok).status_code == 403


def test_spa_also_needs_auth(jwt_client):
    assert jwt_client.get("/").status_code == 403


def test_jwks_outage_is_503(tmp_path):
    client = make_app(tmp_path, JWT_ENV, CF_ACCESS_JWKS_CLIENT=DownJWKS()).test_client()
    assert get(client, token()).status_code == 503


def test_half_configured_aud_refuses_to_start(tmp_path):
    with pytest.raises(RuntimeError):
        make_app(tmp_path, {**JWT_ENV, "OWNER_EMAIL": ""})
    with pytest.raises(RuntimeError):
        make_app(tmp_path, {**JWT_ENV, "CF_ACCESS_TEAM_DOMAIN": ""})


@pytest.mark.parametrize("env,mode", [
    ({"DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "dev"}, "dev"),
    ({"DEV_AUTH_EMAIL": "dev@localhost"}, "dev"),                  # unset APP_ENV = dev
    ({"DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "prod"}, "closed"),  # prod lost its AUD
    ({"DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "uat"}, "closed"),
    ({"APP_ENV": "dev"}, "closed"),
    ({}, "closed"),
    ({**JWT_ENV, "DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "dev"}, "jwt"),  # AUD wins
])
def test_modes(env, mode):
    assert auth_mode(read_auth_config(env)) == mode


def test_closed_mode_denies_everything_but_health(tmp_path):
    client = make_app(tmp_path, {"DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "prod"}).test_client()
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/projects").status_code == 403
    assert client.get("/").status_code == 403


def test_cross_site_writes_blocked(client):
    def post(headers):
        return client.post("/api/v1/projects", json={"name": "x"}, headers=headers).status_code
    assert post({"Sec-Fetch-Site": "cross-site"}) == 403
    assert post({"Sec-Fetch-Site": "same-site"}) == 403
    assert post({"Origin": "https://evil.example"}) == 403
    assert post({"Sec-Fetch-Site": "same-origin"}) == 201
    assert post({"Origin": "http://localhost"}) == 201
    assert client.get("/api/v1/projects", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 200
    up = client.post("/api/v1/projects/x/tasks", headers={"Sec-Fetch-Site": "cross-site"})
    assert up.status_code == 403


def test_me_and_headers(client):
    r = client.get("/api/v1/me")
    assert r.get_json() == {"email": "dev@localhost", "env": "dev"}
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
