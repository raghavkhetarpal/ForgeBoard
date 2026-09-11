# =============================================================================
# ForgeBoard API — Production Dockerfile
# =============================================================================
# Multi-stage build for minimal production image.
#
# Build context: repository root (monorepo)
#   docker build -f apps/api/Dockerfile -t forgeboard-api .
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy root package files and workspace package.json files for install
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/config/package.json packages/config/package.json

# Install all dependencies (including dev for building)
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/validation/node_modules ./packages/validation/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules 2>/dev/null || true

# Copy source
COPY package.json package-lock.json ./
COPY apps/api/ apps/api/
COPY packages/ packages/
COPY prisma/ prisma/

# Generate Prisma client
RUN npx prisma generate

# Build the API (TypeScript → JavaScript)
RUN npm run build --workspace=@forgeboard/api

# ---------------------------------------------------------------------------
# Stage 3: Production runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 forgeboard && \
    adduser --system --uid 1001 forgeboard

# Copy package files for production install
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/config/package.json packages/config/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built API output
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy shared packages source (referenced at runtime via workspace resolution)
COPY --from=builder /app/packages packages

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma

# Switch to non-root user
USER forgeboard

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the API server
# Database migrations should be run as a separate init step, not here
CMD ["node", "apps/api/dist/index.js"]
