# Development image shared by the web and api services.
# Source code is bind-mounted at runtime; only dependencies are baked into the image.
FROM node:26-alpine

RUN npm install -g pnpm@12.18.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile
