import { Link, NavLink, Outlet } from 'react-router-dom'

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-[#0b1628] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-[#35558f]/30 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center" aria-label="Tamay Delivery home">
            <img
              src="/tamay-logo.png"
              alt="Tamay Enterprises"
              className="h-12 w-auto sm:h-14"
            />
            <span className="ml-3 hidden border-l border-[#35558f]/25 pl-3 text-xs font-bold uppercase tracking-[0.16em] text-[#35558f] sm:block">
              Delivery
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-bold sm:gap-5">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive
                  ? 'text-[#35558f]'
                  : 'text-slate-600 transition hover:text-[#35558f]'
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/request"
              className={({ isActive }) =>
                isActive
                  ? 'text-[#35558f]'
                  : 'text-slate-600 transition hover:text-[#35558f]'
              }
            >
              Request delivery
            </NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
