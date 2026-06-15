# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY lib/ ./lib/
COPY artifacts/financeiro/ ./artifacts/financeiro/

# Install deps
RUN pnpm install --frozen-lockfile

# Build frontend
ENV PORT=5173
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN pnpm --filter @workspace/financeiro run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app

RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend dist
COPY --from=backend-builder /app/artifacts/api-server/dist/ ./artifacts/api-server/dist/
COPY --from=backend-builder /app/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/
COPY --from=backend-builder /app/artifacts/api-server/package.json ./artifacts/api-server/package.json

# Copy lib node_modules (drizzle etc)
COPY --from=backend-builder /app/lib/ ./lib/
COPY --from=backend-builder /app/node_modules/ ./node_modules/

# Copy frontend build
COPY --from=frontend-builder /app/artifacts/financeiro/dist/public/ ./artifacts/financeiro/dist/public/

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
