# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install

# Hot-reload dev server. devDependencies stay installed so `bunx drizzle-kit push`
# works inside the container and PGlite fallback runs when DATABASE_URL is unset.
FROM deps AS dev
ENV NODE_ENV=development
ENV PORT=3000
COPY . .
EXPOSE 3000
CMD ["bun", "run", "--hot", "src/index.ts"]

FROM deps AS prod
ENV NODE_ENV=production
ENV PORT=3000
COPY . .
USER bun
EXPOSE 3000
CMD ["bun", "src/index.ts"]
