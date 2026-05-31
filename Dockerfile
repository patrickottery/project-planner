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

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY config.py run.py ./
COPY --from=node-build /app/static/dist ./app/static/dist/

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "run:app"]

# ---- dev stage ----
FROM base AS dev
RUN pip install --no-cache-dir watchdog
CMD ["python", "run.py"]
