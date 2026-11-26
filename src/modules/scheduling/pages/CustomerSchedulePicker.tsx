import { useEffect, useState } from 'react'
import {
  addDays,
  formatDateKey,
  formatWindowTime,
  parseDateKey,
} from '../utils/calendar'
import type {
  AvailableWindow,
  CustomerSchedulingRules,
  ReservationHandle,
} from '../types/scheduling'
import {
  getAvailableWindows,
  getCustomerSchedulingRules,
  reserveWindow,
} from '../services/schedulingService'
import { supabaseConfiguration } from '../../../services/supabase/client'

function dateInTimeZone(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Scheduling is temporarily unavailable.'
}

export function CustomerSchedulePicker() {
  const [now] = useState(() => Date.now())
  const [rules, setRules] = useState<CustomerSchedulingRules | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [windows, setWindows] = useState<AvailableWindow[]>([])
  const [reservation, setReservation] = useState<ReservationHandle | null>(null)
  const [loadingRules, setLoadingRules] = useState(true)
  const [loadingWindows, setLoadingWindows] = useState(false)
  const [reservingWindowId, setReservingWindowId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reservationWarning, setReservationWarning] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getCustomerSchedulingRules()
      .then((response) => {
        if (!active) return
        setRules(response)
        setSelectedDate(dateInTimeZone(response.time_zone))
        setLoadingWindows(true)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoadingRules(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!rules || !selectedDate) return
    let active = true
    getAvailableWindows(selectedDate, selectedDate)
      .then((available) => {
        if (active) setWindows(available)
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoadingWindows(false)
      })

    return () => {
      active = false
    }
  }, [rules, selectedDate])

  async function handleReservation(windowId: string) {
    setReservingWindowId(windowId)
    setError(null)
    setReservationWarning(null)
    try {
      const hold = await reserveWindow(windowId)
      setReservation(hold)
      setWindows((current) => current.filter((window) => window.id !== windowId))
      try {
        sessionStorage.setItem(`tamay-schedule-reservation:${hold.reservation_id}`, hold.reservation_token)
      } catch {
        setReservationWarning('Your delivery window is held, but this browser could not store its secure reservation token. Keep this page open while continuing.')
      }
    } catch (cause) {
      setError(errorMessage(cause))
      try {
        setWindows(await getAvailableWindows(selectedDate, selectedDate))
      } catch (refreshCause) {
        setError(`${errorMessage(cause)} ${errorMessage(refreshCause)}`)
      }
    } finally {
      setReservingWindowId(null)
    }
  }

  const firstAllowedDate = rules
    ? dateInTimeZone(rules.time_zone, new Date(now + rules.minimum_advance_minutes * 60_000))
    : ''
  const latestDate = rules
    ? formatDateKey(addDays(parseDateKey(dateInTimeZone(rules.time_zone)), rules.maximum_advance_days))
    : undefined

  return (
    <main className="min-h-screen bg-[#f4f6f9] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8c7117]">
            Delivery scheduling
          </p>
          <h1 className="mt-2 font-[Georgia] text-3xl text-[#102342] sm:text-4xl">
            Choose a delivery window
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Select a date to see current availability. A window is held only after the
            scheduling service confirms your reservation.
          </p>
        </div>

        {!supabaseConfiguration.isComplete && (
          <div role="alert" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Configure the Supabase URL and public anon key to load live scheduling availability.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {reservation ? (
          <section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
              </svg>
            </div>
            <h2 className="mt-4 font-[Georgia] text-2xl text-[#102342]">Window temporarily held</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your selected time is held until{' '}
              <strong className="text-slate-800">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: rules?.time_zone,
                }).format(new Date(reservation.expires_at))}
              </strong>
              . Continue through checkout to confirm it; payment integration is not connected yet.
            </p>
            {reservationWarning && (
              <p role="status" className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {reservationWarning}
              </p>
            )}
            <p className="mt-4 break-all rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-500">
              Reservation reference: {reservation.reservation_id}
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(16,35,66,0.07)]">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <label htmlFor="schedule-date" className="block text-sm font-bold text-[#102342]">
                Delivery date
              </label>
              <input
                id="schedule-date"
                className="mt-2 min-h-12 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 text-sm text-[#12233d] outline-none focus:border-[#35558f] focus:ring-2 focus:ring-[#35558f]/15"
                type="date"
                min={firstAllowedDate}
                max={latestDate}
                value={selectedDate}
                disabled={loadingRules || !rules}
                onChange={(event) => {
                  setSelectedDate(event.target.value)
                  setReservation(null)
                  setLoadingWindows(true)
                  setError(null)
                }}
              />
              {rules && (
                <p className="mt-2 text-xs text-slate-500">
                  Times shown in {rules.time_zone}. Book up to {rules.maximum_advance_days} days ahead.
                </p>
              )}
            </div>

            <div className="p-4 sm:p-6">
              <h2 className="font-[Georgia] text-xl text-[#102342]">Available windows</h2>
              {loadingRules || loadingWindows ? (
                <p role="status" className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  Loading current availability…
                </p>
              ) : windows.length === 0 ? (
                <p className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
                  No delivery windows are available for this date. Try another date.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {windows.map((window) => (
                    <li key={window.id}>
                      <button
                        type="button"
                        disabled={reservingWindowId !== null}
                        onClick={() => void handleReservation(window.id)}
                        className="flex min-h-[76px] w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-[#35558f] hover:bg-[#f7f9fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f] disabled:cursor-wait disabled:opacity-60"
                      >
                        <span>
                          <span className="block text-sm font-bold text-[#102342]">
                            {formatWindowTime(window.starts_at, rules?.time_zone)} – {formatWindowTime(window.ends_at, rules?.time_zone)}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {window.remaining_capacity} {window.remaining_capacity === 1 ? 'spot' : 'spots'} available
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-[#35558f]">
                          {reservingWindowId === window.id ? 'Holding…' : 'Select →'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Availability is checked again by the scheduling service when you reserve a time, so full windows cannot be booked from a stale screen.
        </p>
      </div>
    </main>
  )
}
