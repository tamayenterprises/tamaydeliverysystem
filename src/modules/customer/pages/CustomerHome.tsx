import { Link } from 'react-router-dom'

const serviceHighlights = [
  { title: 'Company-operated fleet', detail: 'A team and vehicles managed by Tamay' },
  { title: 'Clear communication', detail: 'Know what to expect at every step' },
  { title: 'Local service', detail: 'Proudly serving Connecticut communities' },
]

export function CustomerHome() {
  return (
    <main>
      <section className="relative isolate overflow-hidden bg-[#0b1628]">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse at 82% 18%, rgba(53,85,143,.42), transparent 42%), linear-gradient(145deg, #102342 0%, #0b1628 62%, #091321 100%)',
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.045]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgba(201,162,39,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,.7) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'linear-gradient(90deg, black, transparent 85%)',
          }}
        />

        <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2c76e] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c9a227]" />
              Tamay Enterprises Logistics
            </div>
            <h1 className="font-[Georgia] text-[2.4rem] leading-[1.08] text-white sm:text-5xl lg:text-[3.55rem]">
              Delivery you can count on. <span className="text-[#d7b844]">Handled with care.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Schedule a pickup with our company-operated fleet. Share a few details
              and our team will take it from there.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/request"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#c9a227] px-6 py-3 text-sm font-extrabold text-[#102342] shadow-lg shadow-black/15 transition hover:bg-[#dfbd4f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c76e]"
              >
                Start a delivery request
                <span aria-hidden="true">→</span>
              </Link>
              <span className="text-center text-xs text-slate-400 sm:text-left sm:text-sm">
                No account needed to get started
              </span>
            </div>
          </div>

          <aside className="rounded-xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7b844]">
                  Simple from start to finish
                </p>
                <h2 className="mt-2 font-[Georgia] text-2xl text-white">Your delivery, organized.</h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#c9a227]/15 text-[#e0c65e]" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
                  <circle cx="7.5" cy="18" r="1.5" />
                  <circle cx="17.5" cy="18" r="1.5" />
                </svg>
              </div>
            </div>
            <ol className="mt-6 space-y-4">
              {[
                ['01', 'Tell us what you’re sending', 'Pickup, destination, and package details.'],
                ['02', 'Choose a delivery window', 'Select a time that works for you.'],
                ['03', 'Our team takes it from there', 'We coordinate your delivery with care.'],
              ].map(([number, title, detail]) => (
                <li key={number} className="flex gap-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c9a227]/40 text-xs font-bold text-[#e0c65e]">
                    {number}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8c7117]">The Tamay difference</p>
          <h2 className="mt-2 font-[Georgia] text-2xl text-[#102342] sm:text-3xl">
            A dependable team behind every delivery.
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {serviceHighlights.map((item, index) => (
            <article key={item.title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#102342]/[0.06] text-sm font-extrabold text-[#35558f]">
                0{index + 1}
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#102342]">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
