import { Link } from 'react-router-dom'

export function CustomerHome() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
            Company-managed delivery
          </p>
          <h1 className="text-5xl font-bold leading-tight text-white">
            Reliable delivery across the pickup and destination you choose.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Prepare a delivery request with pickup details, recipient information, and
            package specifications.
          </p>
          <Link
            to="/request"
            className="mt-8 inline-flex rounded-lg bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Start a delivery request
          </Link>
        </div>
      </section>
    </main>
  )
}
