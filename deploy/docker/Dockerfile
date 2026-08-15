# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKETCHFORGE_DOCKER_BUILD=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache libcap \
  && setcap cap_net_bind_service=+ep /usr/local/bin/node

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node deploy/docker/start-server.mjs ./deploy/docker/start-server.mjs

USER node

EXPOSE 80 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "deploy/docker/start-server.mjs"]
