# Multi-platform Dockerfile for Next.js App
# Build: docker buildx build --platform linux/amd64,linux/arm64 -t your-registry/app:latest -f Dockerfile.app .
# Build with buildx and push to registry in one command

FROM --platform=$BUILDPLATFORM node:20-alpine AS base

ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the native dependencies and build
FROM base AS rebuild
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Production image
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=rebuild /app/public ./public
COPY --from=rebuild /app/.next/standalone ./
COPY --from=rebuild /app/.next/static ./.next/static
COPY --from=rebuild /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
