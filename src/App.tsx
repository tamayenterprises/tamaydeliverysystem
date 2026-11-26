import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AdminScheduling } from './modules/scheduling/pages/AdminScheduling'
import { CustomerSchedulePicker } from './modules/scheduling/pages/CustomerSchedulePicker'

function FoundationHome() {
  return (
    <main className="min-h-screen bg-[#0b1628] px-5 py-12 text-white sm:px-8 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          Tamay Delivery System
        </p>
        <h1 className="mt-3 font-[Georgia] text-4xl sm:text-5xl">Scheduling system</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          Manage company delivery availability or check customer-facing windows.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/admin/scheduling"
            className="rounded-lg border border-white/15 bg-white/[0.06] p-5 transition hover:border-[#c9a227]/60"
          >
            <h2 className="font-semibold text-white">Admin scheduling</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Configure hours, windows, booking limits, closures, and reservations.
            </p>
          </Link>
          <Link
            to="/schedule"
            className="rounded-lg border border-white/15 bg-white/[0.06] p-5 transition hover:border-[#c9a227]/60"
          >
            <h2 className="font-semibold text-white">Customer availability</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Browse available dates and place a temporary reservation.
            </p>
          </Link>
        </div>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FoundationHome />} />
        <Route path="/admin/scheduling" element={<AdminScheduling />} />
        <Route path="/schedule" element={<CustomerSchedulePicker />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
