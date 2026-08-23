# ForgeBoard

## Current Features & Status
ForgeBoard is actively under development. Currently implemented backend API modules include:
- **Auth**: Secure session management utilizing Redis.
- **Workspaces**: Multi-tenant organizations with strict RBAC (OWNER, ADMIN, MEMBER, VIEWER).
- **Projects**: Scoped project boards within workspaces, supporting implicit and explicit role inheritance.
- **Issues (Kanban)**: Issue tracking with infinite-precision floating-point ordering (LexoRank-lite) for high-performance Kanban board reordering.
- **Labels**: Project-scoped labels (tags) assigned to issues, cascading automatically on deletion.
- **Comments**: Discussion threads on issues. Editing is strictly author-only, while deletion supports project ADMIN moderation.
- **Mentions & Notifications**: In-comment `@email` mentions dynamically trigger robust, paginated in-app notifications (alongside assignment notifications).

## Local Setup

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For running local PostgreSQL and Redis instances

### 1. Clone the repository

```bash
git clone https://github.com/your-username/forgeboard.git
cd forgeboard
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Review and adjust any variable values in `.env` if necessary.

### 3. Start Database & Cache Services

Start local PostgreSQL and Redis containers via Docker Compose:

```bash
docker compose up -d
```

### 4. Install Dependencies

Install monorepo dependencies across all workspaces:

```bash
npm install
```

### 5. Run Database Migrations

Generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Start Development Servers

Run all workspace applications concurrently:

```bash
npm run dev
```

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
