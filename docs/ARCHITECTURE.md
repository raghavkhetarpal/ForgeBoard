# ForgeBoard — Architecture & Engineering Decisions

Status: Proposed
Last updated: 2026-08-16

This document is the source of truth for technical decisions on ForgeBoard. Any AI coding agent (Antigravity, Claude Code, etc.) or human contributor should treat this as the contract for how the system is built. If a decision here needs to change, update this file in the same PR as the code change — do not let code and doc drift.

---

## 1. System Overview

ForgeBoard is a multi-tenant (workspace-scoped) project management platform with GitHub integration and real-time collaboration. It is a monolith-first system: one API service, one Postgres database, one Redis instance. No microservices, no message queue, no Kubernetes. Complexity is added only where a concrete requirement demands it (see §9 "Why Not X").

```
┌──────────────┐
│   Next.js    │  apps/web
│   Frontend   │
└──────┬───────┘
       │ REST (HTTPS) + WebSocket (WSS)
┌──────▼───────┐
│  Express API │  apps/api
│  (TypeScript)│
└──────┬───────┘
       │
┌──────┴────────────────────┐
│                            │
PostgreSQL (Prisma)     Redis          GitHub REST API + Webhooks
Source of truth         Cache / RT     External integration
                         state / queue
```

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict mode) | Both frontend and backend |
| Frontend | Next.js | App Router |
| Backend | Express + TypeScript | See §9 for why not NestJS/Fastify |
| Database | PostgreSQL | Managed instance in production |
| ORM | Prisma | Schema-first, migrations, type-safe client |
| Cache / RT state | Redis | See §5 — justified use only |
| Real-time transport | Socket.IO | See §6 |
| Monorepo | npm workspaces | No Turborepo/Nx — see §9 |
| Auth | Server-side session (signed httpOnly cookie, session state in Redis) | Server-side authorization always |
| Testing | Vitest/Jest (unit + integration), Playwright or Supertest (E2E/API) | Target 80%+ meaningful backend coverage |
| CI/CD | GitHub Actions | Lint → typecheck → test → build → deploy |
| Hosting | Vercel (web) / Render or Railway or Fly.io (api) / managed Postgres / managed Redis | |

---

## 3. Repository Structure

```
forgeboard/
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # Express backend
│       └── src/
│           └── modules/
│               ├── auth/
│               ├── users/
│               ├── workspaces/
│               ├── memberships/
│               ├── projects/
│               ├── issues/
│               ├── comments/
│               ├── labels/
│               ├── milestones/
│               ├── notifications/
│               ├── activity/
│               ├── github/
│               └── webhooks/
├── packages/
│   ├── types/               # Shared TS types/interfaces (DTOs, enums)
│   ├── validation/          # Shared Zod schemas
│   └── config/               # Shared eslint/tsconfig/env schema
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
├── docs/
│   └── ARCHITECTURE.md      # this file
├── .github/workflows/
├── docker-compose.yml        # local Postgres + Redis
├── README.md
└── package.json
```

Each backend module follows a consistent internal shape:

```
modules/<name>/
├── <name>.routes.ts       # Express router, wires HTTP → controller
├── <name>.controller.ts   # Parses request, calls service, shapes response
├── <name>.service.ts      # Business logic, authorization checks
├── <name>.repository.ts   # Prisma queries only — no business logic here
├── <name>.validation.ts   # Zod input schemas
└── <name>.types.ts        # Module-local types
```

Rule: controllers never call Prisma directly. Services never touch `req`/`res`. This separation is what makes permission logic and business rules unit-testable without spinning up HTTP or a database.

---

## 4. Database (PostgreSQL + Prisma)

PostgreSQL is the single source of truth. Prisma is used for schema definition, migrations, and query access.

Core entities (see `prisma/schema.prisma` for the authoritative version once written):

```
users, workspaces, workspace_members,
projects, project_members,
issues, issue_labels, labels, comments, milestones,
notifications, activities,
github_integrations, github_repositories, github_pull_requests, issue_pull_requests
```

Non-negotiable practices:
- Foreign keys enforced at the DB level, not just app level.
- Unique constraints for things like `(workspace_id, email)` membership pairs.
- Multi-step writes (e.g. "create issue + write activity record") wrapped in a Prisma transaction.
- Indexes on frequently filtered columns: `issues(project_id, status)`, `issues(assignee_id)`, `issues(priority)`, `activities(project_id, created_at)`.
- Every workspace-scoped table carries `workspace_id` (denormalized where needed) so authorization queries can filter without extra joins — this is a deliberate, documented denormalization, not an accident.
- `Issue.creatorId` cascades on user deletion (the issue is deleted if the creator is deleted) while `Issue.assigneeId` uses `SetNull` (the issue survives and becomes unassigned). This is a deliberate choice to avoid losing issue history when a user is removed.
- **Issue Ordering**: Position uses float midpoint insertion (LexoRank-lite). Repeated insertion at the extreme top/bottom of a column asymptotically approaches float precision limits; not an issue at portfolio scale, and a rebalancing pass (renumbering a column's positions to even multiples of a base increment) would be the standard fix if ever needed.
- No soft-delete-everywhere pattern by default; only `activities` is strictly append-only/immutable. Other entities use explicit `archived`/`status` fields as the PRD specifies (e.g. project `ARCHIVED` state), not a blanket `deleted_at` convention, to avoid ambiguous query semantics.
- Workspace slug generation strategy: slugs are URL-friendly derivatives of the workspace name. On collision, append a short random alphanumeric suffix to prevent predictable collision attacks.
- Sole-owner protection rule: The last remaining OWNER of a workspace (or project, where applicable) cannot be deleted, downgraded, or allowed to leave without transferring ownership first.

---

## 5. Redis — Justified Uses Only

Redis is included because it solves four specific problems, not to pad a resume. Each use must remain traceable to one of these:

1. **Session store** — server-side session state (session ID → user ID, expiry, metadata) backing the httpOnly session cookie described in §2. This is what makes sessions instantly revocable (delete the Redis key) versus a stateless JWT, which is the reason session-based auth was chosen over JWT for this project (see §9). Key patterns: `session:<id>` for actual session data, `user_sessions:<userId>` (a set of session IDs) for revoking all sessions of a user, and `pwd_reset:<token>` for password reset flows.
2. **Socket.IO adapter / presence** — tracking which users are connected to which workspace/project rooms across potentially multiple API instances.
3. **Rate limiting** — sliding-window counters for auth endpoints and the GitHub webhook endpoint, using `express-rate-limit` with a Redis store.
4. **Ephemeral notification cache** — short-TTL cache for "unread notification count" so the dashboard doesn't hit Postgres on every page load.

Explicitly **not** used for: primary data storage, long-lived state, or anything that would be a problem to lose on restart. If a future feature wants to use Redis for something outside these three categories, that's a decision that belongs in this document, made deliberately — not added silently.

---

## 6. Real-Time Architecture (Socket.IO)

Flow for a status change:

```
Client PATCH /api/issues/:id
        ↓
Express controller → service (authz + business logic)
        ↓
Prisma write (Postgres) — source of truth
        ↓
Activity record written (same transaction)
        ↓
Service emits event via Socket.IO, scoped to a room: `project:<id>`
        ↓
Redis Socket.IO adapter fans out across instances (if >1 API instance)
        ↓
Connected clients in that project room update UI
```

Rules:
- WebSocket emits happen **after** the DB transaction commits, never before — the DB write is authoritative, the socket event is a notification that state changed, not the state itself.
- Clients reconcile via REST fetch if a socket event is missed (e.g. on reconnect), rather than trusting the socket stream as the sole source of truth. This avoids building a fragile "the UI is only as correct as the last event we happened to receive" system.
- Rooms are scoped by `project:<id>` and `workspace:<id>`, and a server-side check on socket connection/join verifies the connecting user actually has membership — sockets get the same authorization treatment as REST.

---

## 7. GitHub Integration & Webhooks

**Connection flow:** OAuth app (not GitHub App, unless scope creep demands installation-based auth later) → store encrypted access token per workspace/project integration → repository selection via GitHub REST API.

**Webhook flow:**

```
GitHub event (PR opened/updated/merged, review submitted, push)
        ↓
POST /api/webhooks/github
        ↓
Verify HMAC signature (X-Hub-Signature-256) — reject if invalid, before any parsing
        ↓
Check event delivery ID against a dedupe table/Redis key (idempotency)
        ↓
Validate payload shape (Zod)
        ↓
Look up issue_pull_requests link by repo + PR number
        ↓
Update github_pull_requests row + issue status if configured to auto-transition
        ↓
Write activity record
        ↓
Emit Socket.IO event to relevant project room
```

Idempotency is mandatory: GitHub retries webhook delivery on failure, and duplicate processing must not double-write activity records or double-fire notifications. Use the `X-GitHub-Delivery` header as the dedupe key with a short-TTL Redis `SETNX`, or a `webhook_deliveries` table with a unique constraint — pick one, document which, in this file, once implemented.

---

## 8. API Design

RESTful, resource-oriented. All routes go through a consistent middleware chain:

```
requestId → auth (verify token) → rate limit (route-specific) → authorize (role/permission check) → validate (Zod) → controller
```

Every endpoint enforces, in this order: authentication, authorization, input validation, business logic, then a consistent error envelope on failure (`{ error: { code, message } }`, no stack traces or internal detail leaked in production responses).

Authorization is never inferred from the frontend. A request to `PATCH /api/issues/:id` re-derives the requester's role in that issue's workspace from the DB on every call — there is no cached "the UI already checked this" trust boundary.
- **ADMIN Permission Boundary**: A user with the ADMIN role can modify or remove normal members but cannot modify the role or membership of an OWNER or a fellow ADMIN. Only an OWNER can manage other administrators.
- **Project Role vs Workspace Role**: A user's `ProjectRole` (ADMIN, MEMBER, VIEWER) applies specifically to a project and can be *higher* than their `WorkspaceRole`. This is an intentional escalation path: a project ADMIN can grant another workspace member a project role higher than that user's workspace role (e.g., making a workspace VIEWER a project ADMIN). Project roles are independent of workspace roles.
- **Implicit Workspace Access:** A workspace `OWNER` automatically has implicit `ADMIN` access to all projects within the workspace (no explicit `ProjectMember` record required). Workspace `ADMIN`s **must** be explicitly added to a project (as a `ProjectMember`) to gain access. This allows sensitive projects to be scoped securely without all workspace `ADMIN`s automatically inheriting access.
- **Issue Operations Threshold**: Creating, updating, or deleting issues requires a minimum project role of `MEMBER`. `VIEWER` access is strictly read-only for issues.

---

## 9. Why Not X — Documented Tradeoffs

These are the answers this project should be able to give in an interview, kept honest and specific rather than justifying-after-the-fact.

**Why Express, not NestJS or Fastify?**
NestJS's DI/decorator-heavy structure is a good fit for large teams enforcing structure automatically, but for a single-contributor portfolio project it adds a layer of framework magic that doesn't demonstrate more engineering skill than a well-organized Express app with an enforced module convention (see §3). Fastify's main edge is raw throughput, which isn't the bottleneck here — Postgres query patterns and websocket fan-out are.

**Why npm workspaces, not Turborepo/Nx?**
The monorepo here is small (2 apps, 3 shared packages). Turborepo's value is incremental build caching and task orchestration at a scale this project doesn't reach. Adding it before it's needed would be exactly the kind of resume-padding complexity §34 of the PRD explicitly rules out. If build times become a real problem, that's a documented future decision, not a default.

**Why Prisma, not raw SQL/Knex?**
Prisma gives type-safe queries generated from one schema file, real migrations, and enough escape hatches (`$queryRaw`) for the few places raw SQL is genuinely clearer (complex search/filter queries). The tradeoff — some loss of control over exact generated SQL — is acceptable at this scale and is worth the reduction in hand-written boilerplate for the ~15 entities in this schema.

**Why PostgreSQL?**
The domain is inherently relational: workspaces own projects own issues own comments, with foreign keys, unique constraints, and multi-table transactions (e.g. issue status change + activity log write) that need real ACID guarantees. A document store would just reimplement joins in application code.

**Why Redis?**
See §5 — three specific, bounded uses. Not included by default elsewhere.

**Why WebSockets, not polling?**
Polling every client every N seconds to check for issue/comment changes scales linearly with active users and creates load even when nothing changed. A room-scoped event push means the server only sends data when something actually changed.

**Why REST, not GraphQL?**
Most operations here are straightforward resource CRUD with predictable access patterns (get issues for a project, get comments for an issue). GraphQL's value — flexible client-driven queries, avoiding over/under-fetching — matters more for products with deeply nested, client-varying data needs. REST with well-designed nested routes and query params covers this domain's needs with a simpler mental model and simpler caching story.

**Why webhooks, not polling GitHub?**
GitHub's API rate limits make polling every project's PR state impractical at any real scale, and webhooks push state changes the moment they happen — this is the entire justification for the feature (§16 of the PRD: reflecting GitHub reality in project state without drift).

**Why server-side sessions, not JWT?**
JWTs are attractive for stateless horizontal scaling, but this project's actual requirements — instantly revoking access when a member is removed from a workspace, forcing logout on password reset, not having to reason about refresh-token rotation edge cases — favor a session store that can simply be deleted. Redis already exists in this stack (§5) and a session store is one more clearly justified use of it rather than a new piece of infrastructure. The tradeoff is a Redis round-trip per authenticated request instead of a cheap in-memory JWT verify; at this project's scale that cost is negligible next to the correctness and simplicity win.

**Why server-side authorization, always?**
Client-side role checks are UX, not security. Any permission check that only exists in the frontend is trivially bypassed with a direct API call. Every mutating endpoint re-verifies the requester's role against the DB.

---

## 10. Explicit Non-Goals

Restated from the PRD, because the goal is depth over surface area: no AI/LLM features, no microservices, no Kubernetes, no Kafka, no custom auth protocol, no mobile/desktop app. These are principled exclusions, not gaps — the point of ForgeBoard is demonstrating judgment about what *not* to build as much as what to build.

---

## 11. Open Decisions (fill in as Phase 1 proceeds)

- [x] Auth strategy: server-side session (httpOnly cookie + Redis-backed session store) — see §2, §5, §9.
- [x] Auth transport: signed httpOnly cookie (`forgeboard_session`) is the sole production transport. It must be configured with `httpOnly: true`, `secure: true` (in production), `sameSite: 'lax'`, and a robust signing secret. `Authorization: Bearer <sessionId>` is permitted strictly in `NODE_ENV !== 'production'` for automated testing convenience.
- [ ] Webhook idempotency: Redis SETNX vs. `webhook_deliveries` table — pick one, document why here.
- [ ] GitHub OAuth App vs. GitHub App (installation-based) — OAuth App assumed above; revisit if per-repo installation scoping becomes necessary.
- [ ] Hosting target for the API (Render vs Railway vs Fly.io) — pick one once deploying in Phase 6.

---

## 12. How to Use This Document With Antigravity

When prompting the Antigravity agent to scaffold or implement a module, reference this file explicitly (e.g. "follow the module structure and authorization rules in docs/ARCHITECTURE.md") so generated code matches the conventions in §3 and §8 rather than defaulting to whatever pattern the model reaches for. Update §11 as decisions get made, and treat any code that contradicts this document as a bug in either the code or the doc — resolve the conflict explicitly rather than letting them diverge.
