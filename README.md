# ForgeBoard

Multi-tenant project management platform with GitHub integration and real-time collaboration.

## Features

- **Authentication** — Secure session management with Redis-backed httpOnly cookies
- **Workspaces** — Multi-tenant organizations with strict RBAC (OWNER, ADMIN, MEMBER, VIEWER)
- **Projects** — Scoped project boards within workspaces with implicit and explicit role inheritance
- **Kanban Board** — Issue tracking with float-based ordering (LexoRank-lite) for drag-and-drop reordering
- **Labels** — Project-scoped labels with cascading deletion
- **Comments** — Discussion threads on issues with author-only editing and admin moderation
- **Mentions & Notifications** — In-comment `@email` mentions with paginated in-app notifications
- **Milestones** — Iteration planning with issue tracking and progress calculation
- **GitHub Integration** — OAuth-based repository linking, pull request tracking, webhook sync
- **Real-Time Collaboration** — Socket.IO powered live updates across all project views
- **Search & Filtering** — Server-side issue search, filtering by status/priority/label/milestone, cursor pagination
- **Team Administration** — Workspace member management, role promotion/demotion, sole-owner protection

## Quick Start

### Prerequisites

- **Node.js** v20+ and **npm** v10+
- **Docker** & **Docker Compose** (for PostgreSQL and Redis)

### Setup

```bash
# Clone and install
git clone https://github.com/raghavkhetarpal/ForgeBoard.git
cd ForgeBoard
npm install

# Configure environment
cp .env.example .env

# Start database and cache
docker compose up -d

# Run migrations and generate Prisma client
npx prisma generate
npx prisma migrate dev

# Start development servers
npm run dev
```

- **Web App**: http://localhost:3000
- **API Server**: http://localhost:4000
- **API Health**: http://localhost:4000/health

### Docker (Full Stack)

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate
docker compose -f docker-compose.prod.yml up --build -d
```

## Documentation

- [Architecture & Engineering Decisions](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all development servers |
| `npm run build` | Build all workspaces for production |
| `npm run typecheck` | TypeScript type checking across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Run unit and integration tests (Vitest) |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run benchmark:seed` | Seed deterministic test data for performance benchmarking |
| `npm run benchmark` | Execute local Autocannon API load benchmark suite |
| `npm run format` | Format code with Prettier |

## Engineering Highlights

- **Multi-Tenant RBAC & Security**: Strict role inheritance (OWNER, ADMIN, MEMBER, VIEWER), redis-backed httpOnly cookie sessions, input validation via Zod, production security headers via Helmet, and rate limiting on sensitive auth endpoints.
- **Database & Migration Hardening**: Multi-step writes guarded by Prisma ACID transactions, foreign keys enforced at the DB level, and optimized indexes (`issues(project_id, status)`, `activities(project_id, created_at)`).
- **Trigram-Accelerated Issue Search**: Integrated PostgreSQL `pg_trgm` GIN indexes on issue `title` and `description` to prevent sequential table scans during wildcard search (`ILIKE`), achieving up to 94% reduction in p95 search latency under heavy concurrency.
- **Real-Time Synchronization**: Room-scoped Socket.IO events triggered strictly post-DB transaction commit with Redis adapter fan-out for multi-instance readiness.
- **Observability & Health Probes**: Production JSON logging with sensitive data redaction (passwords, tokens, cookies), request correlation via `X-Request-Id`, `/health/ready` readiness checks with DB/Redis ping latency, and Prometheus-compatible runtime metrics (`/health/metrics`).
- **Webhook Hardening**: HMAC signature verification (`X-Hub-Signature-256`) and idempotency checks using GitHub delivery IDs to prevent duplicate activity records or notification triggers.

## Performance Benchmarks

*Note: The numbers below represent empirical measurements from local benchmark runs on developer hardware (Apple Silicon, Node.js v24, PostgreSQL 16, Redis 7).*

The performance benchmark suite tests 5 core API operations under increasing Virtual User (VU) concurrency (10, 25, and 50 VUs) against a standard dataset (10 users, 2 workspaces, 4 projects, 200 issues, 200 activities).

### Baseline Load Benchmark Summary

Across 35,504 total benchmark requests under 10, 25, and 50 VU concurrency, the system maintained a **0.0% error rate**.

| Operation | 10 VUs Throughput | 10 VUs p95 | 25 VUs Throughput | 25 VUs p95 | 50 VUs Throughput | 50 VUs p95 |
|-----------|------------------|------------|------------------|------------|------------------|------------|
| **Issue Listing** (Paginated) | 260.6 RPS | 58 ms | 312.3 RPS | 134 ms | 311.1 RPS | 250 ms |
| **Issue Creation** (Transaction + Activity) | 218.0 RPS | 75 ms | 262.1 RPS | 165 ms | 277.5 RPS | 290 ms |
| **Issue Reorder** (LexoRank update) | 260.0 RPS | 59 ms | 294.0 RPS | 148 ms | 293.4 RPS | 268 ms |
| **Issue Search** (`pg_trgm` GIN Index) | 204.3 RPS | 84 ms | 210.2 RPS | 205 ms | 194.1 RPS | 440 ms |
| **Comment Creation** (Authoring flow) | 215.3 RPS | 74 ms | 272.7 RPS | 158 ms | 273.7 RPS | 292 ms |

### Search Optimization (pg_trgm GIN Index Impact)

Before optimization, wildcard `ILIKE %q%` searches triggered costly sequential table scans, causing p95 latency to degrade significantly as concurrency scaled. Adding PostgreSQL trigram GIN indexes (`pg_trgm`) eliminated the bottleneck:

| Concurrency | Unindexed p95 Latency | Optimized (`pg_trgm`) p95 | Latency Reduction | Unindexed Throughput | Optimized Throughput |
|-------------|-----------------------|---------------------------|-------------------|----------------------|----------------------|
| **10 VUs**  | 733 ms                | **84 ms**                 | **-88.5%**        | 17.7 RPS             | **204.3 RPS**        |
| **25 VUs**  | 3,549 ms              | **205 ms**                | **-94.2%**        | 10.7 RPS             | **210.2 RPS**        |
| **50 VUs**  | 6,473 ms              | **440 ms**                | **-93.2%**        | 5.8 RPS              | **194.1 RPS**        |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + TypeScript |
| Backend | Express + TypeScript |
| Database | PostgreSQL (Prisma ORM + `pg_trgm` GIN indexing) |
| Cache / RT | Redis (ioredis) |
| Real-Time | Socket.IO |
| Auth | Server-side sessions (Redis + signed httpOnly cookies) |
| Monorepo | npm workspaces |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| CI/CD | GitHub Actions |
