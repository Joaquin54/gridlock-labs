# syntax=docker/dockerfile:1

FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Hot-reload dev server. devDependencies stay installed because the PGlite
# fallback imports drizzle-kit/api when DATABASE_URL is unset.
FROM deps AS dev
ENV NODE_ENV=development
ENV PORT=3000
COPY . .
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
  CMD bun -e "process.exit((await fetch('http://127.0.0.1:3000/health')).ok ? 0 : 1)"
CMD ["bun", "run", "--hot", "src/index.ts"]

FROM deps AS prod
ENV NODE_ENV=production
ENV PORT=3000
COPY . .
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
  CMD bun -e "process.exit((await fetch('http://127.0.0.1:3000/health')).ok ? 0 : 1)"
CMD ["bun", "src/index.ts"]
