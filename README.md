# Gridlock Labs — Utility Project Overlaps

ShellHacks 2026 project. Gridlock maps transmission projects from two utilities (Dominion Energy South Carolina and Georgia Power) and flags pairs of projects that overlap in space and time, so crews and planners can spot coordination opportunities. For each overlapping pair it also estimates how much money coordinating the two projects could save, as a low / mid / high band.

The dashboard reads live data from a PostgreSQL database hosted on Tiger Data. Projects, overlaps, stats and savings are fetched from the backend API every time the app loads.

## Repository layout

```
.
├── backend/                  # Bun + Hono API
│   ├── src/
│   │   ├── index.ts          # App entry point (CORS, schema gate, routes)
│   │   ├── routes/           # projects, overlaps, meta (health/stats), export, savings
│   │   ├── queries/          # SQL for projects, points, overlaps, stats
│   │   ├── lib/              # geometry, haversine, confidence, CSV, savings model
│   │   └── db/               # Drizzle schema, client (Tiger or PGlite), fixture data
│   ├── scripts/              # load-tiger, export-deliverables, build-savings
│   ├── db/applied/           # DDL applied to Tiger by hand, in order
│   └── test/                 # bun test suites
├── frontend/                 # React + Vite dashboard
│   ├── scripts/              # Data tooling (xlsx → seed.json, review queue)
│   └── src/
│       ├── api/              # API client (projects, overlaps, stats, savings, documents)
│       ├── components/       # dashboard, search, project detail, upload, layout, shared
│       ├── data/             # GridlockDataContext (loads from the API), mappers, repository
│       ├── hooks/            # useTheme
│       ├── types/            # GridlockProject, ProjectOverlap, SearchFilters
│       └── utils/
├── docs/
│   ├── deliverable/          # Challenge deliverable CSVs + savings estimate
│   ├── load_gap_report.md
│   └── points_join_report.md
├── docker-compose.yml        # Tiger stack
├── docker-compose.offline.yml# Offline override (PGlite, no database)
└── .env-example              # Frontend VITE_API_BASE_URL template
```

## Tech stack

| Area     | Tools                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Runtime  | [Bun](https://bun.sh) (frontend and backend; Node is not required)     |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, React Router 7, Recharts, react-simple-maps, d3-geo |
| Backend  | Hono, Zod, Drizzle ORM + drizzle-kit, `postgres` driver, PGlite (offline mode) |
| Database | PostgreSQL hosted on [Tiger Data](https://www.tigerdata.com)           |
| Tooling  | Biome (lint + format), Docker / docker-compose                         |

## Current status

- **Database:** the Tiger Data tables (`projects`, `project_points`, `points`) and views (`project_geo`, `point_usage`, `overlap_table`, `project_table`) are loaded and live. The schema lives in `backend/src/db/schema.ts`, and every change applied to Tiger is recorded in `backend/db/applied/`. Without `DATABASE_URL`, the backend runs on an in-memory PGlite copy with fixture data.
- **Backend:** Hono API serving projects, live overlaps, stats, manual location edits, the savings estimate, and the CSV / GeoJSON deliverables. See [Backend API](#backend-api).
- **Frontend:** dashboard, search page and project detail page, all fed live from the API through `frontend/src/data/GridlockDataContext.tsx`. Data loads when the app opens; if the API is unreachable, an error screen offers a retry. There is no automatic polling, so refresh the page to pick up changes made elsewhere.
- **Savings estimate:** the dashboard headline and project pages show the coordination-savings band from `GET /savings`. See `docs/deliverable/savings/README.md` for the method.
- **Containers:** `docker compose up --build` runs the whole app locally. See [Run locally with Docker](#run-locally-with-docker).

### Frontend routes

| Path                    | Page                                         |
| ----------------------- | -------------------------------------------- |
| `/`                     | Dashboard: stats, savings headline, SC & GA map, charts |
| `/search`               | Search/filter by name, utility, state, overlaps |
| `/projects/:projectId`  | Project detail, overlapping projects and their savings |
| `/upload`               | PDF upload for utility listing documents (not yet backed by the API — see [Known issues](#known-issues)) |

## Run locally with Docker

Two commands. Bun 1.3.8 images, arm64 and amd64; nothing else needs installing.

```bash
# 1. Tiger stack — the real hosted database
docker compose up --build

# 2. Offline stack — no database, in-memory PGlite + fixture data
docker compose -f docker-compose.yml -f docker-compose.offline.yml up --build
```

Never run both at once: they publish the same backend port.

| Service    | Port   | Notes                                                     |
| ---------- | ------ | --------------------------------------------------------- |
| `frontend` | `5173` | Vite dev server, `src/` bind-mounted for hot reload       |
| `backend`  | `3000` | `bun run --hot src/index.ts`, waits `healthy` on `/health` |

The browser runs on your host, so the frontend reaches the API at
`http://localhost:3000` (the published port) — never at the compose service name.
`CORS_ORIGINS` is pinned to `http://localhost:5173` in `docker-compose.yml`.
The backend container mounts `docs/` read-only (`DOCS_ROOT=/workspace`) so `/savings`
can read the deliverable inputs.

### `backend/.env`

`DATABASE_URL` lives only in `backend/.env`, which is gitignored and reaches the
container through `env_file:`. It is never baked into an image.

```bash
cp backend/.env-example backend/.env   # then ask a teammate for the Tiger value
```

The offline stack overrides `DATABASE_URL` to an explicit empty string, so it works
with or without that file.

> **Never run `drizzle-kit push` (or any migration) against Tiger.** The containers
> only read the database. Schema changes go through `backend/db/applied/` by hand —
> see `backend/db/applied/README.md` and `docs/load_gap_report.md` §6.

There is **no local Postgres container**: Tiger is the database and offline mode is PGlite.

### Known issues

- The `/upload` page POSTs to `/api/documents/upload` (`frontend/src/api/documents.ts`),
  which the backend does not implement yet, so uploads fail.
- `frontend/bun.lock` is gitignored, so a fresh clone has no frontend lockfile for the
  `--frozen-lockfile` install in `frontend/Dockerfile`. (`backend/bun.lock` is committed.)
- Scalar (`@scalar/hono-api-reference`) is installed but not wired up.

### Running without Docker (fallback)

```bash
# Backend (start first — the UI depends on it)
cd backend
bun install
bun run dev          # http://localhost:3000

# Frontend
cd frontend
echo "VITE_API_BASE_URL=http://localhost:3000" > .env
bun install
bun run dev          # http://localhost:5173
```

The frontend refuses to load data if `VITE_API_BASE_URL` is unset.

## Environment variables

| Variable            | Where            | Description |
| ------------------- | ---------------- | ----------- |
| `DATABASE_URL`      | `backend/.env`   | Tiger Data Postgres connection string (`postgres://…?sslmode=require`). **Leave it unset to run on in-memory PGlite with fixture data.** |
| `CORS_ORIGINS`      | `backend/.env`   | Comma-separated allowed origins. Defaults to `http://localhost:5173`; there is no wildcard. |
| `VITE_API_BASE_URL` | `frontend/.env` or root `.env` for compose | Backend URL the browser calls.
