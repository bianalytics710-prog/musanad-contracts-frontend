# Multi-stage Dockerfile for the Musanad Contracts frontend (TanStack Start).
# Build is currently scoped to local/dev. Cloudflare Workers deployment is
# deferred per project.config.json deployment._status. This file produces a
# Node-runtime production image; switch to a static-export or Workers build
# when deploy is enabled.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_DISPLAY_TIMEZONE=Asia/Dubai
ARG VITE_DEFAULT_LOCALE=en
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DISPLAY_TIMEZONE=$VITE_DISPLAY_TIMEZONE \
    VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 5173
CMD ["node", ".output/server/index.mjs"]
