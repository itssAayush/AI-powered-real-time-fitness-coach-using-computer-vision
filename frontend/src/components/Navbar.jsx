import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const navLinkBase =
  "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200";
const navLinkIdle =
  "text-slate-300 hover:bg-white/5 hover:text-white";
const navLinkActive =
  "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]";

function NavItem({ to, end, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setOpen(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    closeMenu();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <NavLink
            to="/"
            end
            onClick={closeMenu}
            className="group flex items-center gap-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg font-bold text-slate-950 shadow-lg shadow-emerald-500/25">
              F
            </span>
            <span className="text-base font-semibold tracking-tight text-white group-hover:text-emerald-200 sm:text-lg">
              Fitness Coach
            </span>
          </NavLink>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <NavItem to="/" end>
            Home
          </NavItem>
          <NavItem to="/workout">Workout</NavItem>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <button
            type="button"
            onClick={handleLogout}
            className={`${navLinkBase} ml-1 border border-white/10 bg-white/[0.04] text-slate-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200`}
          >
            Logout
          </button>
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Toggle menu</span>
          {open ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        id="mobile-nav"
        className={`border-t border-white/[0.06] bg-slate-950/95 px-4 py-3 md:hidden ${open ? "block" : "hidden"}`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:px-6">
          <NavItem to="/" end onNavigate={closeMenu}>
            Home
          </NavItem>
          <NavItem to="/workout" onNavigate={closeMenu}>
            Workout
          </NavItem>
          <NavItem to="/dashboard" onNavigate={closeMenu}>
            Dashboard
          </NavItem>
          <button
            type="button"
            onClick={handleLogout}
            className={`${navLinkBase} mt-1 w-full border border-white/10 bg-white/[0.04] text-left text-slate-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200`}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
