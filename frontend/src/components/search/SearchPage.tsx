import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchCatalog } from "../../data/repository";
import { regionLabel, utilityKeyFromQueueCode } from "../../types/geocode";
import type { SearchFilters, UtilityKey } from "../../types/project";
import { cn } from "../../utils/cn";
import { formatDateLabel, formatMiles } from "../../utils/format";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import TaskBadge from "../shared/TaskBadge";
import UtilityBadge from "../shared/UtilityBadge";

const CLS_CONTROL =
  "box-border w-full min-h-[2.5rem] rounded-sm border-2 border-border-input bg-bg px-[0.7rem] py-[0.48rem] font-sans text-[14px] leading-[1.35] text-text-primary outline-none transition-[border-color] duration-150 hover:border-border-strong focus:border-accent placeholder:text-text-muted";

const CLS_BUTTON_PRIMARY =
  "box-border min-h-[2.5rem] shrink-0 cursor-pointer whitespace-nowrap rounded-sm border-2 border-accent bg-accent px-4 font-sans text-[14px] font-medium text-white transition-[background,border-color] duration-150 hover:border-accent-hover hover:bg-accent-hover";

const CLS_BUTTON_CLEAR =
  "box-border min-h-[2.5rem] min-w-[4rem] cursor-pointer whitespace-nowrap rounded-sm border border-red-200/90 bg-red-50 px-4 font-sans text-[13px] font-medium text-red-700 transition-all duration-150 hover:border-red-300 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/45 dark:text-red-300 dark:hover:border-red-800/70 dark:hover:bg-red-950/70";

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

function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="mb-[0.38rem] whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.06em] text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [draftQuery, setDraftQuery] = useState(applied.query);
  const [draftUtility, setDraftUtility] = useState(applied.utility);
  const [draftState, setDraftState] = useState(applied.state);
  const [draftOverlapsOnly, setDraftOverlapsOnly] = useState(applied.overlapsOnly);

  const results = useMemo(() => searchCatalog(applied), [applied]);

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
    <div className="flex w-full flex-col">
      <div className="mb-3 flex flex-col gap-1">
        <h1 className="m-0 text-[1.05rem] font-semibold leading-tight text-text-primary">
          Search projects
        </h1>
        <p className="m-0 text-[0.8125rem] leading-snug text-text-secondary">
          Search pilot overlap projects and geocode review-queue location points by name, utility,
          state, region, or overlap status.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-stretch gap-[0.4rem] rounded-lg border border-border bg-surface px-3 pt-2.5 pb-3"
      >
        <div className="flex min-w-0 items-center gap-2 pt-0.5 pb-1">
          <input
            type="search"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Substation, line name, project ID, queue point…"
            aria-label="Search projects"
            className={CLS_CONTROL}
          />
          <button type="submit" className={CLS_BUTTON_PRIMARY}>
            Search
          </button>
        </div>

        <div className="flex min-w-0 flex-wrap items-end gap-5">
          <FilterField
            label="Utility"
            className="w-[260px] max-[1100px]:min-w-[150px] max-[1100px]:flex-1"
          >
            <select
              value={draftUtility}
              onChange={(e) => setDraftUtility(e.target.value as "" | UtilityKey)}
              className={CLS_CONTROL}
            >
              <option value="">All utilities</option>
              <option value="dominion">Dominion Energy (SC)</option>
              <option value="georgia-power">Georgia Power</option>
            </select>
          </FilterField>

          <FilterField label="State" className="w-[175px] max-[1100px]:min-w-[120px]">
            <select
              value={draftState}
              onChange={(e) => setDraftState(e.target.value as "" | "GA" | "SC")}
              className={CLS_CONTROL}
            >
              <option value="">All states</option>
              <option value="SC">South Carolina</option>
              <option value="GA">Georgia</option>
            </select>
          </FilterField>

          <FilterField label="Overlaps" className="shrink-0">
            <label className="inline-flex min-h-[2.5rem] cursor-pointer items-center gap-2 text-[14px] text-text-primary">
              <input
                type="checkbox"
                checked={draftOverlapsOnly}
                onChange={(e) => setDraftOverlapsOnly(e.target.checked)}
                className="size-4 accent-accent"
              />
              Overlaps only
            </label>
          </FilterField>

          <div className="ml-auto shrink-0">
            <button type="button" onClick={clearFilters} className={CLS_BUTTON_CLEAR}>
              Clear All
            </button>
          </div>
        </div>
      </form>

      <p className="m-0 pt-2 pl-1 text-[0.8125rem] text-text-secondary">
        <strong className="font-medium text-text-primary">{results.length}</strong> result
        {results.length === 1 ? "" : "s"}
      </p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-text-muted text-[0.92rem]">
          <strong className="text-[15px] text-text-secondary">No results found</strong>
          <p className="m-0 mt-1 text-sm">Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
          {results.map((item) => {
            if (item.kind === "pilot") {
              const p = item.project;
              return (
                <button
                  key={`pilot-${p.id}`}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="group cursor-pointer border-none bg-surface px-[1.25rem] py-[0.6rem] text-left transition-[background] duration-100 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="m-0 min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-[1.4] text-text-primary group-hover:text-accent-hover">
                      {p.name}
                    </h3>
                    <span className="shrink-0 font-mono text-[0.6875rem] text-text-muted">
                      {p.id}
                    </span>
                  </div>
                  <div className="mt-[0.4rem] flex flex-wrap items-center gap-1.5 text-[12px] leading-none text-text-secondary">
                    <UtilityBadge utilityKey={p.utilityKey} />
                    <span className="rounded-full bg-accent/10 px-[0.42rem] py-[0.12rem] text-[10px] font-medium text-accent-text">
                      Pilot overlap
                    </span>
                    <span>{p.state}</span>
                    <span className="text-border-strong" aria-hidden>
                      ·
                    </span>
                    <span>In service {formatDateLabel(p.inServiceDate)}</span>
                    {p.overlapCount > 0 ? (
                      <span className="ml-auto inline-block rounded-full bg-green-light px-[0.42rem] py-[0.12rem] text-[10px] font-medium text-green">
                        {p.overlapCount} overlap{p.overlapCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            }

            const p = item.point;
            const utilityKey = utilityKeyFromQueueCode(p.utility);
            const state = p.utility === "DESC" ? "SC" : "GA";
            const located = p.lat != null && p.lon != null && !Number.isNaN(p.lat);

            return (
              <div key={`queue-${p.id}`} className="bg-surface px-[1.25rem] py-[0.6rem] text-left">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="m-0 min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-[1.4] text-text-primary">
                    {p.pointName}
                  </h3>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-text-muted">
                    {p.id}
                  </span>
                </div>
                <p className="m-0 mt-1 truncate text-[12px] text-text-secondary">{p.projectName}</p>
                <div className="mt-[0.4rem] flex flex-wrap items-center gap-1.5 text-[12px] leading-none text-text-secondary">
                  <UtilityBadge utilityKey={utilityKey} />
                  <span>{state}</span>
                  <span className="text-border-strong" aria-hidden>
                    ·
                  </span>
                  <span>{regionLabel(p.region)}</span>
                  {p.miles != null ? (
                    <>
                      <span className="text-border-strong" aria-hidden>
                        ·
                      </span>
                      <span>{formatMiles(p.miles)}</span>
                    </>
                  ) : null}
                  <TaskBadge task={p.task} />
                  <ConfidenceBadge confidence={p.confidence} />
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-medium",
                      located ? "text-green" : "text-text-muted",
                    )}
                  >
                    {located ? "On map" : "Coordinates pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
