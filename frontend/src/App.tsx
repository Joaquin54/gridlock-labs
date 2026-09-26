import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const SearchPage = lazy(() => import("./components/search/SearchPage"));
const ProjectDetailPage = lazy(() => import("./components/project/ProjectDetailPage"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-text-muted text-sm" role="status">
      Loading…
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  return (
    <AppShell flushMain={isDashboard}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
