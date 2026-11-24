FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tar && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
FROM base AS build
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN DATABASE_URL=file:/tmp/build.db npm run build && npm prune --omit=dev
FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build /app /app
RUN mkdir -p /data /app/.next/cache && chown -R node:node /data /app/.next/cache
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:deploy && exec ./node_modules/.bin/next start -H 0.0.0.0"]
