import { type FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchProjects } from "../../data/repository";
import type { SearchFilters, UtilityKey } from "../../types/project";
import { cn } from "../../utils/cn";
import { formatDateLabel } from "../../utils/format";
import UtilityBadge from "../shared/UtilityBadge";

function parseFilters(params: URLSearchParams): SearchFilters {
  const utility = params.get("utility");
  const state = params.get("state");
  return {
    query: params.get("q") ?? "",
    utility: utility === "dominion" || utility === "georgia-power" ? utility : "",
    state: state === "GA" || state === "SC" ? state : "",
    overlapsOnly: params.get("overlaps") === "1",
  };
}

function filtersToParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.query.trim()) p.set("q", filters.query.trim());
  if (filters.utility) p.set("utility", filters.utility);
  if (filters.state) p.set("state", filters.state);
  if (filters.overlapsOnly) p.set("overlaps", "1");
  return p;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [draftQuery, setDraftQuery] = useState(applied.query);
  const [draftUtility, setDraftUtility] = useState(applied.utility);
  const [draftState, setDraftState] = useState(applied.state);
  const [draftOverlapsOnly, setDraftOverlapsOnly] = useState(applied.overlapsOnly);

  const results = useMemo(() => searchProjects(applied), [applied]);

  const applyDraft = () => {
    const next: SearchFilters = {
      query: draftQuery,
      utility: draftUtility,
      state: draftState,
      overlapsOnly: draftOverlapsOnly,
    };
    setSearchParams(filtersToParams(next), { replace: true });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyDraft();
  };

  const clearFilters = () => {
    setDraftQuery("");
    setDraftUtility("");
    setDraftState("");
    setDraftOverlapsOnly(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold m-0">Search projects</h1>
        <p className="text-sm text-text-secondary m-0 mt-1">
          Filter Dominion and Georgia Power projects by name, utility, state, or overlap status.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-lg shadow-sm p-4 space-y-3"
      >
        <label className="block">
          <span className="text-[0.78rem] uppercase tracking-wide text-text-muted">Keywords</span>
          <input
            type="search"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Substation, line name, project ID…"
            className="mt-1 w-full box-border rounded-sm border border-border-input bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[0.78rem] uppercase tracking-wide text-text-muted">Utility</span>
            <select
              value={draftUtility}
              onChange={(e) => setDraftUtility(e.target.value as "" | UtilityKey)}
              className="mt-1 w-full box-border rounded-sm border border-border-input bg-bg px-3 py-2 text-sm"
            >
              <option value="">All utilities</option>
              <option value="dominion">Dominion Energy (SC)</option>
              <option value="georgia-power">Georgia Power</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[0.78rem] uppercase tracking-wide text-text-muted">State</span>
            <select
              value={draftState}
              onChange={(e) => setDraftState(e.target.value as "" | "GA" | "SC")}
              className="mt-1 w-full box-border rounded-sm border border-border-input bg-bg px-3 py-2 text-sm"
            >
              <option value="">All states</option>
              <option value="SC">South Carolina</option>
              <option value="GA">Georgia</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draftOverlapsOnly}
              onChange={(e) => setDraftOverlapsOnly(e.target.checked)}
              className="size-4 accent-accent"
            />
            <span className="text-sm text-text-primary">Overlaps only</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-sm bg-accent text-white border-none text-sm font-medium cursor-pointer hover:bg-accent-hover"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 rounded-sm bg-surface-hover border border-border text-sm cursor-pointer hover:border-border-strong"
          >
            Clear
          </button>
        </div>
      </form>

      <p className="text-sm text-text-secondary m-0">
        <strong className="text-text-primary">{results.length}</strong> result
        {results.length === 1 ? "" : "s"}
      </p>

      <ul className="m-0 p-0 list-none space-y-2">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${p.id}`)}
              className={cn(
                "w-full text-left bg-surface border border-border rounded-lg shadow-sm px-4 py-3",
                "hover:border-border-strong hover:bg-surface-hover transition-colors cursor-pointer",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <UtilityBadge utilityKey={p.utilityKey} />
                <span className="font-mono text-[0.72rem] text-text-muted">{p.id}</span>
                <span className="text-[0.72rem] text-text-muted">{p.state}</span>
                {p.overlapCount > 0 ? (
                  <span className="text-[0.72rem] font-semibold text-green">
                    {p.overlapCount} overlap{p.overlapCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <p className="m-0 font-medium text-text-primary">{p.name}</p>
              <p className="m-0 mt-1 text-[0.82rem] text-text-secondary">
                In service {formatDateLabel(p.inServiceDate)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {results.length === 0 ? (
        <div className="text-center py-10 text-text-muted text-sm">
          No projects match these filters.
        </div>
      ) : null}
    </div>
  );
}
