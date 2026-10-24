FROM node:24.13.1-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN cd server && DATABASE_URL=postgresql://build:build@localhost/build pnpm exec prisma generate
RUN pnpm --filter @en/server build && pnpm --filter @en/server exec nest build ai
ARG WEB_BASE=/
ARG RELEASE_ID=local
RUN pnpm --filter @en/tracker build && pnpm --filter @en/web build --base="$WEB_BASE"
RUN node -e 'require("fs").writeFileSync("apps/web/dist/release.json", JSON.stringify({release: process.env.RELEASE_ID}))'

FROM build AS backend
ENV NODE_ENV=production
WORKDIR /app/server
CMD ["node", "dist/apps/server/apps/server/src/main.js"]

FROM nginx:1.28-alpine AS web
COPY deploy/nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
