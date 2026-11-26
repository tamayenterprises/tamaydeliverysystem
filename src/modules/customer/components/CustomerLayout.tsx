import { Link, NavLink, Outlet } from 'react-router-dom'

export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f9] text-[#12233d]">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Tamay Delivery home">
            <img
              src="/tamay-logo.png"
              alt=""
              aria-hidden="true"
              className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold leading-tight tracking-wide text-[#102342] sm:text-base">
                TAMAY
              </span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase leading-tight tracking-[0.2em] text-[#587095] sm:text-[10px]">
                Delivery Services
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `hidden rounded-md px-3 py-2 text-sm font-semibold transition sm:inline-flex ${
                  isActive ? 'text-[#35558f]' : 'text-slate-600 hover:text-[#35558f]'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/schedule"
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center justify-center rounded-md px-2.5 py-2 text-[11px] font-bold transition sm:px-3 sm:text-sm ${
                  isActive ? 'text-[#35558f]' : 'text-slate-600 hover:text-[#35558f]'
                }`
              }
            >
              Schedule
            </NavLink>
            <NavLink
              to="/request"
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center justify-center rounded-md px-3.5 py-2 text-xs font-bold transition sm:min-h-11 sm:px-4 sm:text-sm ${
                  isActive
                    ? 'bg-[#102342] text-white'
                    : 'bg-[#c9a227] text-[#102342] hover:bg-[#dfbd4f]'
                }`
              }
            >
              Request delivery
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-semibold text-slate-700">Tamay Enterprises · Delivery Services</span>
          <span>Reliable service, handled with care.</span>
        </div>
      </footer>
    </div>
  )
}
