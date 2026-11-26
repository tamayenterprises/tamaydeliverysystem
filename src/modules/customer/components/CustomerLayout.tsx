import { Link, NavLink, Outlet } from 'react-router-dom'

export function CustomerLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-bold text-white">
            Tamay Delivery
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-sky-400' : 'text-slate-300 hover:text-white'
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/request"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-sky-400' : 'text-slate-300 hover:text-white'
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
