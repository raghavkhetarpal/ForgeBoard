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
| `npm run format` | Format code with Prettier |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + TypeScript |
| Backend | Express + TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Cache / RT | Redis (ioredis) |
| Real-Time | Socket.IO |
| Auth | Server-side sessions (Redis + signed httpOnly cookies) |
| Monorepo | npm workspaces |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| CI/CD | GitHub Actions |
