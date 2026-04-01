# Multi-platform Dockerfile for Next.js App
# 构建: docker buildx build --platform linux/amd64 --load -t deepdivenote-app:latest -f Dockerfile.app .

FROM --platform=$BUILDPLATFORM node:20-alpine AS base

ARG BUILDPLATFORM
ARG TARGETPLATFORM

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS rebuild
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

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
