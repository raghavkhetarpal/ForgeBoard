# ForgeBoard

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
