import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import sperryLogo from "../../assets/sperrylogo.png";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../utils/cn";

type AppShellProps = {
  children: ReactNode;
  flushMain?: boolean;
};

function navClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "shrink-0 px-3 py-[0.35rem] rounded-sm border-none font-sans text-[13px] font-medium cursor-pointer transition-[color,background] duration-150",
    isActive
      ? "text-accent-text bg-accent-light"
      : "bg-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover",
  );
}

export default function AppShell({ children, flushMain }: AppShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="grid grid-rows-[auto_minmax(0,1fr)] h-full overflow-hidden font-sans">
      <header className="bg-surface border-b border-border grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 h-[50px] gap-4">
        <NavLink
          to="/"
          className="flex items-center no-underline justify-self-start rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <img
            src={sperryLogo}
            alt="Sperry technologies"
            className="h-9 w-auto max-w-[min(100%,220px)] object-contain object-left"
          />
        </NavLink>

        <nav className="flex items-center justify-center gap-1" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/search" className={navClass}>
            Search
          </NavLink>
          <NavLink to="/upload" className={navClass}>
            Upload
          </NavLink>
        </nav>

        <div className="flex items-center justify-end gap-3 justify-self-end">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-[0.4rem] px-[0.65rem] py-[0.3rem] rounded-sm bg-surface-hover border border-border text-text-secondary text-[12px] font-medium cursor-pointer transition-[color,border-color,background] duration-150 hover:border-border-strong hover:text-text-primary hover:bg-surface"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <span className="hidden sm:inline">
              {theme === "light" ? "Dark mode" : "Light mode"}
            </span>
            <span className="text-sm leading-none" aria-hidden="true">
              {theme === "light" ? "🌙" : "☀️"}
            </span>
          </button>
          <span className="hidden lg:inline text-[11px] text-text-muted uppercase tracking-[0.06em]">
            Sperry Tech Challenge
          </span>
        </div>
      </header>

      <main
        className={cn(
          "min-h-0 overflow-y-auto",
          flushMain ? "" : "p-[1.1rem_1.5rem] max-[900px]:px-3 max-[900px]:py-3",
        )}
      >
        {children}
      </main>
    </div>
  );
}
