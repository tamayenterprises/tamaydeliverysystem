import { Link } from 'react-router-dom'

export function CustomerHome() {
  return (
    <main
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 18% 20%, rgba(53,85,143,.24), transparent 38%), linear-gradient(145deg, #0d1a30 0%, #0b1628 55%, #091321 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(201,162,39,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,.6) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <section className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-3xl border-l border-[#c9a227]/50 pl-6 sm:pl-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[#c9a227]">
            Company-managed delivery
          </p>
          <h1 className="font-[Georgia] text-5xl leading-[1.08] text-white sm:text-6xl">
            Reliable delivery across the pickup and destination you choose.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">
            Prepare a delivery request with pickup details, recipient information, and
            package specifications.
          </p>
          <Link
            to="/request"
            className="mt-8 inline-flex rounded-sm bg-[#c9a227] px-6 py-3.5 font-bold text-[#0b1628] transition hover:bg-[#dfbd4f]"
          >
            Start a delivery request
          </Link>
        </div>
      </section>
    </main>
  )
}
