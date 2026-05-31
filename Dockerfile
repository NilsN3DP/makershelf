FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL=file:./prisma/dev.db
ARG DATABASE_PROVIDER=sqlite
ARG MAKERSHELF_PRODUCT_PROFILE=single
ARG MAKERSHELF_DEPLOYMENT_MODE=single-user
ARG MAKERSHELF_DATA_BACKEND=browser
ARG MAKERSHELF_STORAGE_DRIVER=filesystem
ARG MAKERSHELF_APP_NAME=makershelf
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_PROVIDER=$DATABASE_PROVIDER
ENV MAKERSHELF_PRODUCT_PROFILE=$MAKERSHELF_PRODUCT_PROFILE
ENV MAKERSHELF_DEPLOYMENT_MODE=$MAKERSHELF_DEPLOYMENT_MODE
ENV MAKERSHELF_DATA_BACKEND=$MAKERSHELF_DATA_BACKEND
ENV MAKERSHELF_STORAGE_DRIVER=$MAKERSHELF_STORAGE_DRIVER
ENV MAKERSHELF_APP_NAME=$MAKERSHELF_APP_NAME
RUN node scripts/prisma-run.mjs generate && npm run build

FROM base AS runner
WORKDIR /app
# ffmpeg is required for RTSP → MJPEG transcoding (webcam streaming proxy)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/prisma-run.mjs ./scripts/prisma-run.mjs
COPY --from=builder /app/scripts/demo-seed.mjs ./scripts/demo-seed.mjs
COPY --from=builder /app/scripts/demo-cleanup.mjs ./scripts/demo-cleanup.mjs
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 3000 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const port = process.env.PORT || 3000; fetch('http://127.0.0.1:' + port + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "server.js"]
