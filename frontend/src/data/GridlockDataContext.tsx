import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError } from "../api/client";
import { fetchOverlaps, fetchProjects, fetchSavings, fetchStats } from "../api/gridlock";
import type { ApiStats } from "../api/types";
import type { ReviewQueuePoint } from "../types/geocode";
import type {
  CatalogSearchResult,
  GridlockProject,
  ProjectOverlap,
  SearchFilters,
} from "../types/project";
import { resetCountyIndex } from "./countyIndex";
import {
  overlapsFromApi,
  projectsFromFeatures,
  reviewQueuePointsFromFeatures,
} from "./mappers";
import {
  getDashboardSummary,
  getLinkedProjects,
  getOverlapsForProject,
  getProjectById,
  getRankedCoordinationOpportunities,
  getSavingsSpotlightOpportunity,
  savingsLookupFromReport,
  savingsTotalsFromReport,
  searchCatalog,
  type SavingsTotals,
  type SourcedCostImpact,
} from "./repository";

type LoadState = "loading" | "ready" | "error";

type GridlockDataContextValue = {
  state: LoadState;
  error: string | null;
  projects: GridlockProject[];
  overlaps: ProjectOverlap[];
  queuePoints: ReviewQueuePoint[];
  stats: ApiStats | null;
  reload: () => void;
  getProject: (id: string) => GridlockProject | undefined;
  overlapsForProject: (id: string) => ProjectOverlap[];
  linkedProjects: (project: GridlockProject) => GridlockProject[];
  search: (filters: SearchFilters) => CatalogSearchResult[];
  dashboardSummary: ReturnType<typeof getDashboardSummary>;
  rankedOpportunities: ReturnType<typeof getRankedCoordinationOpportunities>;
  savingsByPair: Map<string, SourcedCostImpact>;
  savingsTotals: SavingsTotals | null;
  savingsSpotlight: ReturnType<typeof getSavingsSpotlightOpportunity>;
};

const GridlockDataContext = createContext<GridlockDataContextValue | null>(null);

export function GridlockDataProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<GridlockProject[]>([]);
  const [overlaps, setOverlaps] = useState<ProjectOverlap[]>([]);
  const [queuePoints, setQueuePoints] = useState<ReviewQueuePoint[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [savingsByPair, setSavingsByPair] = useState<Map<string, SourcedCostImpact>>(new Map());
  const [savingsTotals, setSavingsTotals] = useState<SavingsTotals | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    resetCountyIndex();
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError(null);

    (async () => {
      try {
        const [features, overlapRows, statsRow, savingsReport] = await Promise.all([
          fetchProjects(),
          fetchOverlaps(),
          fetchStats(),
          fetchSavings().catch(() => null),
        ]);
        if (cancelled) return;
        const overlapModels = overlapsFromApi(overlapRows);
        const projectModels = projectsFromFeatures(features, overlapRows);
        const points = reviewQueuePointsFromFeatures(features);
        setOverlaps(overlapModels);
        setProjects(projectModels);
        setQueuePoints(points);
        setStats(statsRow);
        if (savingsReport) {
          setSavingsByPair(savingsLookupFromReport(savingsReport));
          setSavingsTotals(savingsTotalsFromReport(savingsReport));
        } else {
          setSavingsByPair(new Map());
          setSavingsTotals(null);
        }
        setLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load data from the API.";
        setError(message);
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const getProject = useCallback(
    (id: string) => getProjectById(projects, id),
    [projects],
  );

  const overlapsForProject = useCallback(
    (id: string) => getOverlapsForProject(overlaps, id),
    [overlaps],
  );

  const linkedProjects = useCallback(
    (project: GridlockProject) => getLinkedProjects(projects, project),
    [projects],
  );

  const search = useCallback(
    (filters: Parameters<typeof searchCatalog>[2]) =>
      searchCatalog(projects, queuePoints, filters),
    [projects, queuePoints],
  );

  const dashboardSummary = useMemo(
    () => getDashboardSummary(projects, overlaps),
    [projects, overlaps],
  );

  const rankedOpportunities = useMemo(
    () => getRankedCoordinationOpportunities(overlaps, savingsByPair),
    [overlaps, savingsByPair],
  );

  const savingsSpotlight = useMemo(
    () => getSavingsSpotlightOpportunity(rankedOpportunities),
    [rankedOpportunities],
  );

  const value = useMemo(
    (): GridlockDataContextValue => ({
      state: loadState,
      error,
      projects,
      overlaps,
      queuePoints,
      stats,
      reload,
      getProject,
      overlapsForProject,
      linkedProjects,
      search,
      dashboardSummary,
      rankedOpportunities,
      savingsByPair,
      savingsTotals,
      savingsSpotlight,
    }),
    [
      loadState,
      error,
      projects,
      overlaps,
      queuePoints,
      stats,
      reload,
      getProject,
      overlapsForProject,
      linkedProjects,
      search,
      dashboardSummary,
      rankedOpportunities,
      savingsByPair,
      savingsTotals,
      savingsSpotlight,
    ],
  );

  return <GridlockDataContext.Provider value={value}>{children}</GridlockDataContext.Provider>;
}

export function useGridlockData(): GridlockDataContextValue {
  const ctx = useContext(GridlockDataContext);
  if (!ctx) {
    throw new Error("useGridlockData must be used within GridlockDataProvider");
  }
  return ctx;
}

export function DataLoadGate({ children }: { children: ReactNode }) {
  const { state, error, reload } = useGridlockData();

  if (state === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center text-text-muted text-sm"
        role="status"
      >
        Loading portfolio from API…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <p className="m-0 text-[0.9375rem] font-medium text-text-primary">Could not reach the API</p>
        <p className="m-0 max-w-md text-[0.8125rem] leading-snug text-text-secondary">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="cursor-pointer rounded-sm border-2 border-accent bg-accent px-4 py-2 font-sans text-[14px] font-medium text-white hover:bg-accent-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  return children;
}
