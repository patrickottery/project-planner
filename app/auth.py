"""Request authentication — every route except /health.

Cloudflare Access is the login. Each request through the tunnel carries a
Cf-Access-Jwt-Assertion header; this verifies it (RS256 signature against the team's
JWKS, audience, issuer, expiry) and checks the email against OWNER_EMAIL. Verifying
here rather than trusting the tunnel means a request that skips Cloudflare — the LAN
port, another container on proxy-network — gets nothing.

Modes, decided once in init_auth():
- jwt:    CF_ACCESS_AUD set. CF_ACCESS_TEAM_DOMAIN and OWNER_EMAIL must be set too,
          or the app refuses to start.
- dev:    CF_ACCESS_AUD blank AND DEV_AUTH_EMAIL set AND APP_ENV=dev. Only safe because
          the dev port is bound to 127.0.0.1.
- closed: anything else — every request 403s. A prod .env that loses its AUD fails
          closed, not open.

Ported from ~/code/therapy-explorer/therapy_explorer/auth.py (minus its internal token).
"""

import os
from urllib.parse import urlsplit

import jwt
from flask import g, jsonify, request
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

PUBLIC_PATHS = {"/health"}
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def read_auth_config(env=None):
    env = os.environ if env is None else env
    s = lambda k: (env.get(k) or "").strip()  # noqa: E731
    return {
        "CF_ACCESS_AUD": s("CF_ACCESS_AUD"),
        "CF_ACCESS_TEAM_DOMAIN": s("CF_ACCESS_TEAM_DOMAIN")
        .removeprefix("https://").removeprefix("http://").rstrip("/"),
        "OWNER_EMAILS": [e.strip() for e in s("OWNER_EMAIL").lower().split(",") if e.strip()],
        "DEV_AUTH_EMAIL": s("DEV_AUTH_EMAIL"),
        "APP_ENV": s("APP_ENV") or "dev",
    }


def auth_mode(cfg) -> str:
    if cfg["CF_ACCESS_AUD"]:
        if not (cfg["CF_ACCESS_TEAM_DOMAIN"] and cfg["OWNER_EMAILS"]):
            raise RuntimeError("CF_ACCESS_AUD is set but CF_ACCESS_TEAM_DOMAIN or OWNER_EMAIL is blank")
        return "jwt"
    if cfg["DEV_AUTH_EMAIL"] and cfg["APP_ENV"] == "dev":
        return "dev"
    return "closed"


def _deny(code: int, msg: str):
    return jsonify({"error": msg}), code


class _Auth:
    def __init__(self, app):
        self.app = app
        self.cfg = app.config["AUTH"]
        self.mode = auth_mode(self.cfg)
        self._jwks = app.config.get("CF_ACCESS_JWKS_CLIENT")  # tests inject a local one

    def _jwks_client(self):
        if self._jwks is None:
            self._jwks = PyJWKClient(f"https://{self.cfg['CF_ACCESS_TEAM_DOMAIN']}/cdn-cgi/access/certs")
        return self._jwks

    def _verify(self, token: str):
        """Returns the token's email, or a (response, status) tuple to deny with."""
        try:
            key = self._jwks_client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, key.key, algorithms=["RS256"],
                audience=self.cfg["CF_ACCESS_AUD"],
                issuer=f"https://{self.cfg['CF_ACCESS_TEAM_DOMAIN']}",
                options={"require": ["exp", "aud", "iss"]},
            )
        except PyJWKClientConnectionError:
            # The token may be fine — Cloudflare's key endpoint is unreachable. 403 would
            # send you hunting through Access config for nothing.
            return _deny(503, "Cannot reach Cloudflare Access to verify token")
        except PyJWTError:
            return _deny(403, "Invalid Access token")
        return (claims.get("email") or "").strip().lower()

    @staticmethod
    def _cross_site_check():
        """Block state-changing requests that a browser marks as coming from another site."""
        if request.method not in UNSAFE_METHODS:
            return None
        fetch_site = request.headers.get("Sec-Fetch-Site")
        if fetch_site is not None:
            return None if fetch_site in ("same-origin", "none") else _deny(403, "Cross-site request blocked")
        origin = request.headers.get("Origin")
        if origin and urlsplit(origin).netloc != request.host:
            return _deny(403, "Cross-site request blocked")
        return None

    def check_request(self):
        """before_request hook. Returns None to allow, or a response to deny."""
        if request.path in PUBLIC_PATHS:
            return None
        if self.mode == "closed":
            return _deny(403, "Authentication is not configured")
        if self.mode == "dev":
            g.user = self.cfg["DEV_AUTH_EMAIL"]
            return self._cross_site_check()

        token = request.headers.get("Cf-Access-Jwt-Assertion")
        if not token:
            return _deny(403, "Missing Cloudflare Access token")
        email = self._verify(token)
        if not isinstance(email, str):
            return email
        if not email or email not in self.cfg["OWNER_EMAILS"]:
            return _deny(403, "Not authorized")
        g.user = email
        return self._cross_site_check()


def add_security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    resp.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
    return resp


def init_auth(app):
    """Read config (unless a test supplied AUTH), validate it, and install the hooks."""
    app.config.setdefault("AUTH", read_auth_config())
    auth = _Auth(app)  # raises on a half-configured AUD → the app refuses to start
    if auth.mode == "closed":
        app.logger.warning("auth: CF_ACCESS_AUD is blank and the dev bypass is off — every request will get 403")
    app.extensions["auth"] = auth
    app.before_request(auth.check_request)
    app.after_request(add_security_headers)
    return auth
