# =============================================================================
# ForgeBoard Web — Production Dockerfile
# =============================================================================
# Multi-stage build for Next.js standalone output.
#
# Build context: repository root (monorepo)
#   docker build -f apps/web/Dockerfile -t forgeboard-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.forgeboard.example.com/api \
#     --build-arg NEXT_PUBLIC_APP_URL=https://forgeboard.example.com \
#     --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.forgeboard.example.com .
#
# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy root package files and workspace package.json files
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/config/package.json packages/config/package.json

# Need API package.json for workspace resolution even though we don't build it
COPY apps/api/package.json apps/api/package.json

# Install all dependencies
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time environment variables (baked into Next.js bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SOCKET_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY package.json package-lock.json ./
COPY apps/web/ apps/web/
COPY apps/api/package.json apps/api/package.json
COPY packages/ packages/
COPY prisma/ prisma/

# Generate Prisma client (needed by shared types)
RUN npx prisma generate

# Build Next.js with standalone output
RUN npm run build --workspace=@forgeboard/web

# ---------------------------------------------------------------------------
# Stage 3: Production runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 forgeboard && \
    adduser --system --uid 1001 forgeboard

# Copy standalone server output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Switch to non-root user
USER forgeboard

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the Next.js standalone server
CMD ["node", "apps/web/server.js"]
