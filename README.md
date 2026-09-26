# Gridlock — Utility Project Overlaps

ShellHacks 2026 project. Gridlock maps transmission projects from multiple utilities (Dominion Energy South Carolina, Georgia Power) and flags projects that overlap in space and time, so crews and planners can spot coordination opportunities.

## Repository layout

```
.
├── backend/            # Bun + Hono API (early scaffold)
│   └── src/index.ts    # App entry point
├── frontend/           # React + Vite dashboard
│   ├── scripts/        # Data tooling (xlsx → seed.json)
│   └── src/
│       ├── components/ # dashboard, search, project detail, layout, shared
│       ├── data/       # repository.ts + seed.json (current data source)
│       ├── hooks/      # useTheme
│       ├── types/      # GridlockProject, ProjectOverlap, SearchFilters
│       └── utils/
└── .env-example        # Root env template (placeholder)
```

## Tech stack

| Area     | Tools                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Runtime  | [Bun](https://bun.sh) (frontend and backend; Node is not required)     |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Router 7, Recharts, react-simple-maps |
| Backend  | Hono, Drizzle ORM + drizzle-kit, `postgres` driver, Scalar API reference |
| Database | PostgreSQL hosted on [Tiger Data](https://www.tigerdata.com)           |
| Tooling  | Biome (lint + format), Docker / docker-compose                         |

## Current status

- **Frontend:** working dashboard, search page, and project detail page. Data is loaded from the static `frontend/src/data/seed.json` through `frontend/src/data/repository.ts`.
- **Backend:** Hono app with a single `GET /` route. Drizzle, the Postgres driver, and Scalar are installed but not wired up yet.
- **Database:** Tiger Data Postgres instance is the planned target; no schema or migrations exist yet.
- **Containers:** docker-compose setup is coming soon (see below).

### Frontend routes

| Path                    | Page                                         |
| ----------------------- | -------------------------------------------- |
| `/`                     | Dashboard — stats, regional map, charts      |
| `/search`               | Search/filter by name, utility, state, overlaps |
| `/projects/:projectId`  | Project detail and linked overlapping projects |

## Development environment

All development happens **inside Docker containers** orchestrated with `docker-compose`. The compose file is not in the repo yet; once it lands, the workflow will be:

```bash
cp .env-example .env        # fill in values (see Environment variables)
docker compose up --build   # start frontend + backend containers
```

Planned services:

| Service    | Port   | Notes                                   |
| ---------- | ------ | --------------------------------------- |
| `frontend` | `5173` | Vite dev server (already binds `0.0.0.0`, `strictPort`) |
| `backend`  | `3000` | `bun run --hot src/index.ts`            |

There is **no local Postgres container**: both local development and deployment connect to the hosted Tiger Data database.

### Running without Docker (fallback)

```bash
# Frontend
cd frontend
bun install
bun run dev          # http://localhost:5173

# Backend
cd backend
bun install
bun run dev          # http://localhost:3000
```

## Environment variables

`.env-example` and `backend/.env-example` are placeholders for now. The backend is expected to need at least:

| Variable       | Description                                      |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | Tiger Data Postgres connection string (`postgres://…?sslmode=require`) |

Never commit `.env` — it is gitignored.

## Frontend scripts

Run from `frontend/`:

| Command             | Does                                               |
| ------------------- | -------------------------------------------------- |
| `bun run dev`       | Start Vite dev server on `0.0.0.0:5173`            |
| `bun run build`     | Type-check, then production build to `dist/`       |
| `bun run preview`   | Serve the build on port `4173`                     |
| `bun run typecheck` | `tsc --noEmit`                                     |
| `bun run lint`      | `biome check .`                                    |
| `bun run format`    | `biome check --write .`                            |
| `bun run sync-seed` | Regenerate `src/data/seed.json` from the challenge spreadsheet |

### Regenerating seed data

`sync-seed` reads `Sperry-Tech-Challenge/Projects_Overlaps.xlsx` at the repo root (gitignored; get it from the challenge materials) and writes the `projects` and `overlaps` sheets to `frontend/src/data/seed.json`.

## Code style

- 2-space indentation, double quotes, 100-char line width (Biome, `frontend/biome.json`).
- TypeScript strict mode; explicit types.
- Functional React components.
