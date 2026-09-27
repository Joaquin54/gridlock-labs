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
- **Backend:** Hono API over the Drizzle schema — projects, live overlaps, stats, manual location edits, and the CSV / GeoJSON deliverables. See [Backend API](#backend-api). Scalar is installed but not wired up.
- **Database:** the Drizzle schema (`backend/src/db/schema.ts`) is final; the Tiger Data tables have not been created yet, so the backend runs on an in-memory PGlite copy with fixture data until `DATABASE_URL` is set.
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

See `backend/.env-example`.

| Variable       | Description                                      |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | Tiger Data Postgres connection string (`postgres://…?sslmode=require`). **Leave it unset to run on in-memory PGlite with fixture data.** |
| `CORS_ORIGINS` | Comma-separated allowed origins. Defaults to `http://localhost:5173`; there is no wildcard. |

Never commit `.env` — it is gitignored.

## Backend API

Snake_case on the wire, matching the column names and the deliverable CSVs. No response envelope and no pagination (252 projects at most).

| Method | Route | Notes |
| ------ | ----- | ----- |
| `GET` | `/health` | `{ ok, db }`; 503 while the schema is missing |
| `GET` | `/projects` | GeoJSON FeatureCollection, unlocated projects included. `utility`, `confidence=high,medium,low`, `located`, `inScope`, `bbox=w,s,e,n` |
| `GET` | `/projects/:id` | Detail Feature: properties + `points[]` + `overlaps[]`. Ids hold spaces and commas — send them through `encodeURIComponent` |
| `GET` | `/overlaps` | Live DESC × GPC pairs. `maxMiles=25`, `maxGapDays`, `minConfidence`, `inScope=true`, `sort=distance\|gap` |
| `PATCH` | `/projects/:id/points/:seq` | Save a hand-checked location: `{ lat, lon, source_url }` |
| `GET` | `/stats` | Header counts |
| `GET` | `/export/projects_desc.csv`, `/export/projects_gpc.csv` | Deliverable project tables |
| `GET` | `/export/overlaps.csv` | Deliverable overlap table; same params as `/overlaps` |
| `GET` | `/export/projects_desc.geojson`, `/export/projects_gpc.geojson` | One FeatureCollection per utility |
| `GET` | `/export/location_overrides.csv` | Every `manual` point, to back up edits before a loader re-run |

Bad input returns 400 with `{ error, issues }`.

### Creating the tables (one time)

The Tiger database has no tables yet. One person runs this once, with `DATABASE_URL` set:

```bash
cd backend
bunx drizzle-kit push
```

That applies `src/db/schema.ts` — the two tables plus the `project_geo` view — and writes no migration files. Until it has been run, `/health` returns 503 with `{ schema: false, missing: [...] }` and every other route returns the same, while the server still starts.

### Backend scripts

| Script              | Command                     |
| ------------------- | --------------------------- |
| `bun run dev`       | `bun run --hot src/index.ts` |
| `bun run typecheck` | `tsc --noEmit`              |
| `bun run test`      | `bun test`                  |

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
