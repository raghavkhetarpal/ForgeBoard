# ForgeBoard — Deployment Guide

This document covers how to deploy ForgeBoard for development, Docker-based local production, and cloud production environments.

---

## Architecture Overview

```
┌──────────────┐      ┌──────────────┐
│  Next.js Web │◄────►│  Express API │
│  (Port 3000) │ REST │  (Port 4000) │
│              │  +   │              │
│  Static +    │ WSS  │  Socket.IO   │
│  SSR Pages   │      │  + REST API  │
└──────────────┘      └──────┬───────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              ┌─────▼─────┐   ┌──────▼──────┐
              │ PostgreSQL │   │    Redis    │
              │  (Primary  │   │  (Sessions, │
              │   Store)   │   │   Pub/Sub,  │
              └────────────┘   │   Cache)    │
                               └─────────────┘
```

| Component | Production Target | Notes |
|-----------|------------------|-------|
| **Web** | Vercel, Coolify, or Docker | Next.js with `output: 'standalone'` |
| **API** | Render, Railway, Fly.io, or Docker | Express + Socket.IO on same port |
| **PostgreSQL** | Managed (Neon, Supabase, RDS) | Must support SSL in production |
| **Redis** | Managed (Upstash, Redis Cloud) | Used for sessions, Socket.IO adapter |

---

## Environment Variables

All variables are documented in [`.env.example`](../.env.example). Copy it to `.env`:

```bash
cp .env.example .env
```

### Required in Production

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Must be `production` |
| `DATABASE_URL` | PostgreSQL connection string (with SSL) |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | ≥16-char cryptographic random string |
| `NEXT_PUBLIC_APP_URL` | Public URL of the frontend |
| `NEXT_PUBLIC_API_URL` | Public URL of the API (with `/api` suffix) |
| `NEXT_PUBLIC_SOCKET_URL` | Public URL of the API (base, no `/api`) |

### Optional Observability & Monitoring

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log severity level (`debug`, `info`, `warn`, `error`) | `info` in production, `debug` in dev |
| `SENTRY_DSN` | Sentry or OpenTelemetry-compatible error tracking DSN | Disabled (structured JSON logs) |

### Generate Secrets

```bash
# Session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption key (for GitHub token encryption)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Critical Production Notes

- `NEXT_PUBLIC_*` variables are **baked into the Next.js bundle at build time**. Changing them requires a rebuild.
- `SESSION_SECRET` must be consistent across API restarts — changing it invalidates all active sessions.
- `ENCRYPTION_KEY` is required in production if GitHub integration is enabled. Without it, the API will throw on startup.

---

## Local Development

### Prerequisites

- Node.js v20+
- npm v10+
- Docker & Docker Compose

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL and Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env

# 4. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# 5. Start development servers
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/health

---

## Docker Deployment (Full Stack)

Build and run the entire stack in containers using the production Docker Compose:

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with production values

# 2. Run database migrations
docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate

# 3. Build and start all services
docker compose -f docker-compose.prod.yml up --build -d

# 4. Verify services
curl http://localhost:4000/health    # API health check
curl http://localhost:3000           # Frontend
```

### Individual Docker Builds

```bash
# Build API image (from repo root)
docker build -f apps/api/Dockerfile -t forgeboard-api .

# Build Web image (from repo root — NEXT_PUBLIC_* are build args)
docker build -f apps/web/Dockerfile -t forgeboard-web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.example.com .
```

---

## Database Migrations

Prisma migrations are version-controlled in `prisma/migrations/`.

### Development

```bash
# Create a new migration from schema changes
npx prisma migrate dev --name <migration_name>

# Apply pending migrations
npx prisma migrate dev
```

### Production / CI

```bash
# Apply pending migrations without interactive prompts
npx prisma migrate deploy
```

> **Important:** Always run `prisma migrate deploy` before starting the API in a new environment. The API Dockerfile intentionally does NOT run migrations at container start — migrations should be an explicit, controlled deployment step.

### Docker Migration

```bash
# Run migrations using the Docker migration container
docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate
```

---

## Cloud Deployment

### Vercel (Frontend)

1. Connect the repository to Vercel.
2. Set the **Root Directory** to `apps/web`.
3. Set **Build Command** to `cd ../.. && npm ci && npx prisma generate && npm run build --workspace=@forgeboard/web`.
4. Set **Output Directory** to `.next`.
5. Configure environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://api.your-domain.com/api`
   - `NEXT_PUBLIC_APP_URL` = `https://your-domain.com`
   - `NEXT_PUBLIC_SOCKET_URL` = `https://api.your-domain.com`

### Render / Railway / Fly.io (API)

1. Connect the repository.
2. Set **Build Command**: `npm ci && npx prisma generate && npm run build --workspace=@forgeboard/api`
3. Set **Start Command**: `npx prisma migrate deploy && node apps/api/dist/index.js`
4. Configure all required environment variables (see table above).
5. Ensure the platform exposes WebSocket support (Socket.IO requires it).

### Managed Database & Redis

- **PostgreSQL**: Neon, Supabase, or AWS RDS. Use the connection string in `DATABASE_URL`.
- **Redis**: Upstash or Redis Cloud. Use the connection string in `REDIS_URL`.

---

## Observability, Health Probes & Metrics

The API provides production-grade structured logging, request tracing, centralized error reporting with provider abstraction, and runtime metrics.

### Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/health` | `GET` | **Liveness Probe**: Confirms API process is alive | `200 OK` `{ "status": "ok", "service": "api", "uptimeSeconds": ... }` |
| `/health/ready` | `GET` | **Readiness Probe**: Verifies PostgreSQL & Redis ping | `200 OK` if all dependencies respond; `503 Service Unavailable` with latency details if degraded |
| `/health/metrics` | `GET` | **Runtime Metrics**: Memory, request count, error count, latency percentiles (avg, p95), Socket.IO clients | JSON snapshot by default; Prometheus text exposition when `Accept: text/plain` |

### Capabilities

- **Structured JSON Logging**: Single-line machine-readable logs in `production`, colorized in `development`.
- **Automatic Data Redaction**: Automatically redacts passwords, tokens, API keys, session secrets, private keys, cookies, and authorization headers.
- **Distributed Request Tracing**: Assigns and returns `X-Request-Id` on all responses, correlating duration (ms), method, route, and status code.
- **Centralized Error Reporting**: Pluggable provider abstraction (`ErrorReportingProvider`). Uses `LocalLoggerProvider` by default and activates `SentryReportingProvider` when `SENTRY_DSN` is configured.
- **Crash Protection**: Global listeners for `uncaughtException` and `unhandledRejection` capture errors through the reporter before exiting.
- **Latency & Error Metrics**: Tracks total requests, active requests, error responses, latency distribution (avg, min, max, p95), and active Socket.IO connections.

### Prometheus Scraping Configuration

To scrape metrics using Prometheus or OpenTelemetry Collector:

```yaml
scrape_configs:
  - job_name: 'forgeboard-api'
    metrics_path: '/health/metrics'
    static_configs:
      - targets: ['api:4000']
    headers:
      Accept: 'text/plain'
```

---

## Production Checklist

- [ ] `NODE_ENV=production` is set explicitly
- [ ] `SESSION_SECRET` is a unique, cryptographic random string
- [ ] `DATABASE_URL` points to a managed PostgreSQL instance with SSL
- [ ] `REDIS_URL` points to a managed Redis instance
- [ ] `NEXT_PUBLIC_APP_URL` matches the actual deployed frontend URL
- [ ] `NEXT_PUBLIC_API_URL` matches the actual deployed API URL (with `/api`)
- [ ] `NEXT_PUBLIC_SOCKET_URL` matches the API base URL (without `/api`)
- [ ] CORS origin (`NEXT_PUBLIC_APP_URL`) matches the frontend domain
- [ ] `ENCRYPTION_KEY` is set if GitHub integration is enabled
- [ ] Database migrations have been applied (`prisma migrate deploy`)
- [ ] Session cookie `secure: true` is active (enforced when `NODE_ENV=production`)
- [ ] Bearer token auth fallback is disabled (enforced when `NODE_ENV=production`)
- [ ] No `.env` files are committed to the repository

---

## CI/CD Pipeline

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs:

```
lint-and-typecheck ──┬──► build ────┐
                     │              ├──► e2e (Playwright)
                     └──► test ─────┘
```

| Job | Purpose |
|-----|---------|
| `lint-and-typecheck` | ESLint + TypeScript across all workspaces |
| `test` | Vitest unit + integration tests (PostgreSQL + Redis services) |
| `build` | Production `npm run build` for all workspaces |
| `e2e` | Playwright end-to-end tests (Chromium, full stack) |

Deployment is intentionally manual — connect your hosting platform (Vercel, Render, etc.) directly to the `main` branch for auto-deploy after CI passes.

---

## Troubleshooting

### API can't connect to PostgreSQL/Redis

Verify the connection strings and ensure the services are running:
```bash
docker compose ps         # Check container health
docker compose logs postgres  # Check PostgreSQL logs
```

### CORS errors in the browser

Ensure `NEXT_PUBLIC_APP_URL` in the API environment matches exactly the URL the browser loads the frontend from (including protocol and port).

### Session cookies not persisting

- In production: ensure `NODE_ENV=production` so `secure: true` is set on cookies.
- Cross-origin: cookies require `sameSite: 'lax'` and matching domains. If API and frontend are on different domains, you may need a reverse proxy to serve them from the same domain.

### Socket.IO connection failures

- Verify `NEXT_PUBLIC_SOCKET_URL` points to the API server's base URL.
- Ensure your hosting platform supports WebSocket connections (some require explicit configuration).
