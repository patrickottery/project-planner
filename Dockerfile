# ---- node build ----
FROM node:24-slim AS node-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- python runtime ----
FROM python:3.13-slim AS base
WORKDIR /app

RUN groupadd -g 1000 appuser && useradd -u 1000 -g appuser -m appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY config.py run.py ./
COPY --from=node-build /app/static/dist ./app/static/dist/

RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 5000

# --preload: create_app() (and db.create_all) runs once in the master, not per worker.
CMD ["gunicorn", "--preload", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "run:app"]

# ---- dev: Flask dev server with the reloader; debugger only if FLASK_DEBUG=1 ----
FROM base AS dev
USER root
RUN pip install --no-cache-dir watchdog==6.0.0
USER appuser
CMD ["python", "run.py"]

# ---- prod (same as base; named for BUILD_TARGET=prod) ----
FROM base AS prod
