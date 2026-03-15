# Stage 1: Install dependencies
FROM node:22.14.0-slim AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev, required for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:22.14.0-slim AS build
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set Next.js telemetry to disabled during build
ENV NEXT_TELEMETRY_DISABLED=1

# Dummy env vars needed at build time (Next.js page data collection)
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV AUTH_SECRET=dummy-build-secret
ENV AUTH_GOOGLE_ID=dummy
ENV AUTH_GOOGLE_SECRET=dummy
ENV ALLOWED_EMAILS=dummy@dummy.com

# Build the Next.js application (standalone output)
RUN pnpm build

# Stage 3: Production runner
FROM node:22.14.0-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy migration files
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Set correct ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./scripts/entrypoint.sh"]
