# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Gridlock (ShellHacks 2026)

Dashboard that maps transmission projects from two utilities (Dominion Energy SC, Georgia Power) and flags pairs that overlap in space (`distanceMi`) and time (`timeGapDays`).

## Commands

Bun is the only runtime (no Node). `frontend/bunfig.toml` sets `[run] bun = true` so vite/tsc/biome run under Bun despite `node` shebangs.

Frontend (`cd frontend`):
- `bun run dev` — Vite on `0.0.0.0:5173` (`strictPort`, fails if taken)
- `bun run build` — `tsc --noEmit` then `vite build`
- `bun run typecheck` / `bun run lint` (`biome check .`) / `bun run format` (`biome check --write .`)
- `bun run sync-seed` — regenerate `src/data/seed.json` from `Sperry-Tech-Challenge/Projects_Overlaps.xlsx` at repo root (gitignored; comes from challenge materials)

Backend (`cd backend`):
- `bun run dev` — `bun run --hot src/index.ts`, port 3000

No test framework is configured in either package. Backend has no lint script or biome config yet.

Docker/docker-compose is the planned dev environment but no compose file exists yet. No local Postgres: DB is hosted on Tiger Data via `DATABASE_URL` (`?sslmode=require`).

## Architecture

- **Frontend has no backend dependency today.** All data comes from static `frontend/src/data/seed.json` through `frontend/src/data/repository.ts`, which is the single data-access layer (lookup maps, search filtering, dashboard summary, utility labels/badge classes). Components call repository functions synchronously — swapping to the API later means changing `repository.ts` (and making calls async), not the components.
- **Data pipeline:** xlsx `projects` + `overlaps` sheets → `scripts/sync-seed-from-xlsx.mjs` → `seed.json` → `repository.ts` adds derived `utilityKey` (`"dominion"` if utility name contains "dominion", else `"georgia-power"`). Types live in `src/types/project.ts`; lat/lon, labels, and dates are nullable and code must handle missing coordinates.
- Overlaps are referenced two ways: per-project `overlapProjectIds` (from `overlap_1..3` columns) and the standalone `overlaps` list keyed by `projectIdA`/`projectIdB`.
- **Routing** (`App.tsx`): `/` dashboard, `/search`, `/projects/:projectId`; pages lazy-loaded; `/dashboard` and unknown paths redirect to `/`. `AppShell` gets `flushMain` on the dashboard.
- **Styling:** Tailwind v4 with CSS-var design tokens in `src/index.css` `@theme` (e.g. `bg-surface`, `text-text-muted`, `text-dominion`, `bg-georgia-light`) — use these tokens, not raw colors. Dark mode is `[data-theme="dark"]` on `<html>`, set by `useTheme` (persisted to localStorage `gridlock-theme`). Chart theming in `utils/chartStyles.ts`; `cn` helper in `utils/cn.ts`.
- **Backend:** Hono scaffold with only `GET /`. Drizzle ORM, `postgres` driver, drizzle-kit, and Scalar API reference are installed but unwired; no schema or migrations exist.

## Style notes

Frontend Biome: 2-space, double quotes, 100-char lines; ignores `seed.json` and `index.css`. Backend file currently uses single quotes / no semicolons (Hono template) — match neighboring code.

---

# Global Engineering Directives (v2 — tiered)

## Prompt Contract
Every prompt has three parts: **Goals**, **Constraints**, **Failure Conditions**. User does not specify workflow/routing/skills per-prompt — default workflow below is always active unless explicitly overridden for that prompt only.

## Step 0 — Classify Complexity Tier (replaces unconditional `/caveman full`)

Before anything else, classify the task into one tier. This classification is what the rest of the pipeline scales against — everything downstream reads this tier.

- **Tier 0 — Mechanical.** Typo, single-line config, rename, formatting, single-value change. No ambiguity, no design decision.
- **Tier 1 — Known-pattern implementation.** Implementing an existing, well-documented technology or library (OAuth via Passport, a standard CRUD endpoint, a new field on an existing model) where a matching pattern already exists in this repo or is standard for the framework. No new trust boundary, no new architecture decision.
- **Tier 2 — Novel or high-risk.** New schema/migration, new auth or session architecture, payment flow, new public-facing trust boundary, anything genuinely ambiguous with multiple defensible approaches, or anything explicitly flagged security-sensitive.

**Only Tier 2 runs `/caveman full`.** Tier 0/1 skip it — the goal of that command is surfacing hidden assumptions in genuinely novel problems, which known-pattern work doesn't have.

## Step 1 — Delegate to `tech-lead-supervisor`

Hand Goals/Constraints/Failure Conditions + the assigned tier to the supervisor.

- **Tier 0:** Supervisor executes directly. Minimal plan (1–2 lines), no subagent delegation.
- **Tier 1:** Supervisor delegates to the single relevant engineer agent (`backend-engineer-expert` or `frontend-engineer`). No multi-agent decomposition unless the task genuinely spans both. If an existing pattern exists in the repo for this integration, the agent follows it directly rather than re-deriving an approach — note the mirrored pattern in the report, don't debate it.
- **Tier 2:** Full decomposition as originally specified — multiple subagents, supervisor reviews/challenges all work before returning upstream.

`frontend-engineer` invokes `ui-ux-pro-max` only when the change is novel/user-facing design work (new component, new layout, new interaction pattern) — not for style tweaks matching existing components.

`security-audit-agent` triggers only when a change:
- introduces a new auth/session mechanism or modifies an existing one,
- touches secret storage/handling,
- opens a new trust boundary (new public endpoint, new external integration receiving user data),
- is explicitly Tier 2.

Routine input validation, DTOs following an established pattern, or internal-only endpoints do not trigger it by default.

## Step 2 — Structured Plan (before any code)

- **Tier 0:** Skip — just state the change and verify check inline.
- **Tier 1/2:** Required, same format as before:
```
1. [Step] → verify: [executable check]
2. [Step] → verify: [executable check]
```
Checks must be concrete ("`tsc --noEmit` clean", "`POST /login` returns 200 with valid JWT") — not "make it work."

## Step 3 — Framework Skills

Unchanged: agents decide framework skills at runtime based on actual stack.

## Step 4 — Verification

- **Tier 0/1:** The executing agent's/supervisor's own verification *is* the final verification. No separate independent re-run — unless the agent itself flags uncertainty, in which case it escalates to Tier 2 verification.
- **Tier 2:** Full independent orchestrator verification as originally specified. Claimed-but-not-run = failed. Send failures back down.

## Step 5 — Output to User

Unchanged: what was done, key decisions, what was verified and how, stated assumptions, tier assigned and why (one line), anything needed before approving.

---

## Anti-Hallucination Rules (unchanged, all tiers)
- Read before edit — never modify a file not viewed this turn.
- Verify symbols/APIs exist via lookup, not memory.
- Verify file paths exist before writing/editing.
- Surface unverified assumptions in the upward report; never bury them.

## Surgical Changes (unchanged, all tiers)
- Every changed line traces to the Goals. No opportunistic renames/reformatting/comment cleanup unless asked.
- Match style of neighboring code, not repo-wide conventions.
- Clean up only orphans your changes created; report pre-existing dead code, don't delete it.
- No speculative abstractions — add on second concrete caller, not before.
- No defensive code for impossible cases. Validate at trust boundaries only.
- 200 lines that could be 50 → rewrite.

## Ask vs. Proceed (unchanged)
- **Proceed + state assumption:** reversible, low-stakes, one interpretation clearly likelier.
- **Ask:** irreversible (migration, schema, public API, deletion), scope-changing, or two interpretations produce meaningfully different work.
- **Never silently pick** between scope-changing options.

## Context & Token Discipline (unchanged, now reinforced by tiering)
- Minimum viable context — delegate only the slice needed.
- Read narrowly — ranged reads, grep, symbol lookup, never `cat` large files for 20 lines.
- No redundant re-reads — already loaded this turn = reuse it.
- Summarize upward — compact structured summaries, not raw transcripts.
- Output discipline — surgical `str_replace` over full rewrites, no narration of routing, no recap, no filler.
- Fail fast on scope creep — stop and ask rather than silently consuming the window.

## Global Code Standards (unchanged)
- 2-space indentation. Explicit types always.
- React: prefer functional components.
- Never introduce race conditions. Always memory-safe.
- Never push to GitHub. Never use `rm -rf` or destructive flags.
- If a user decision looks architecturally wrong: name the concern, propose alternative, proceed with user's choice. Document disagreement, never suppress it.
- Only modify files the task requires.
