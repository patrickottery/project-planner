# ---- node build ----
FROM node:20-slim AS node-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- python runtime ----
FROM python:3.12-slim AS base
WORKDIR /app

RUN groupadd -r appuser && useradd -r -u 1000 -g appuser appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY config.py run.py ./
COPY --from=node-build /app/static/dist ./app/static/dist/

RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "run:app"]

# ---- dev stage ----
FROM base AS dev
USER root
RUN pip install --no-cache-dir watchdog
USER appuser
CMD ["python", "run.py"]
