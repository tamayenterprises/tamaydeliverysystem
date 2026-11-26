import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  addDays,
  dateInTimeZone,
  formatDateKey,
  formatWindowTime,
  parseDateKey,
} from '../../scheduling/utils/calendar'
import {
  getAvailableWindows,
  getCustomerSchedulingRules,
  reserveWindow,
} from '../../scheduling/services/schedulingService'
import type {
  AvailableWindow,
  CustomerSchedulingRules,
  ReservationHandle,
} from '../../scheduling/types/scheduling'
import { supabaseConfiguration } from '../../../services/supabase/client'
import type {
  DeliveryPreference,
  DeliveryRequestDraft,
  PackageCategory,
} from '../types/deliveryRequest'

const STORAGE_KEY = 'tamay-delivery-request-draft'

const initialDraft: DeliveryRequestDraft = {
  pickupAddress: '',
  pickupContactName: '',
  pickupContactPhone: '',
  destinationAddress: '',
  recipientName: '',
  recipientPhone: '',
  deliveryPreference: '',
  deliveryDate: '',
  deliveryWindowId: '',
  packageCategory: 'box',
  description: '',
  lengthInches: '',
  widthInches: '',
  heightInches: '',
  weightPounds: '',
  specialHandling: '',
}

function loadDraft(): DeliveryRequestDraft {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return initialDraft

  try {
    return { ...initialDraft, ...(JSON.parse(saved) as Partial<DeliveryRequestDraft>) }
  } catch {
    return initialDraft
  }
}

const categoryOptions: Array<{ value: PackageCategory; label: string }> = [
  { value: 'box', label: 'Box or parcel' },
  { value: 'envelope', label: 'Envelope or document' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'construction', label: 'Construction material' },
  { value: 'other', label: 'Other' },
]

const deliveryPreferenceOptions: Array<{
  value: DeliveryPreference
  label: string
  description: string
}> = [
  {
    value: 'earliest_available',
    label: 'Earliest Available',
    description: 'Deliver as soon as operationally possible.',
  },
  {
    value: 'morning',
    label: 'Morning Delivery',
    description: 'Preferred delivery between 8 AM–12 PM.',
  },
  {
    value: 'afternoon',
    label: 'Afternoon Delivery',
    description: 'Preferred delivery between 12 PM–5 PM.',
  },
  {
    value: 'evening',
    label: 'Evening Delivery',
    description: 'Preferred delivery between 5 PM–8 PM.',
  },
  {
    value: 'specific_two_hour_window',
    label: 'Specific 2-Hour Window',
    description: 'Choose a specific available two-hour period.',
  },
  {
    value: 'specific_date',
    label: 'Specific Date',
    description: 'Choose a delivery date without selecting an exact time.',
  },
  {
    value: 'appointment_delivery',
    label: 'Appointment Delivery',
    description: 'The company coordinates a specific time with the recipient.',
  },
]

const deliveryPreferenceRanges: Partial<Record<DeliveryPreference, [number, number]>> = {
  morning: [8 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 20 * 60],
}

const fieldClass =
  'mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#12233d] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#35558f] focus:ring-2 focus:ring-[#35558f]/15'

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Scheduling is temporarily unavailable.'
}

function minutesAtTimeZone(dateTime: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(dateTime))
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return Number(values.hour) * 60 + Number(values.minute)
}

function windowsForPreference(
  preference: DeliveryPreference | '',
  windows: AvailableWindow[],
  timeZone: string,
): AvailableWindow[] {
  if (preference === 'specific_two_hour_window') {
    return windows.filter(
      (window) => Date.parse(window.ends_at) - Date.parse(window.starts_at) === 2 * 60 * 60 * 1000,
    )
  }

  const range = preference ? deliveryPreferenceRanges[preference] : undefined
  if (!range) return windows

  return windows.filter((window) => {
    const startsAt = minutesAtTimeZone(window.starts_at, timeZone)
    const endsAt = minutesAtTimeZone(window.ends_at, timeZone)
    return startsAt >= range[0] && endsAt <= range[1]
  })
}

function isWindowUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P0001'
  )
}

async function findEarliestAvailableWindows(
  startDate: string,
  endDate: string,
): Promise<AvailableWindow[]> {
  let chunkStart = parseDateKey(startDate)
  const lastDate = parseDateKey(endDate)
  const windows: AvailableWindow[] = []

  while (chunkStart <= lastDate) {
    const chunkEnd = addDays(chunkStart, 90)
    const end = chunkEnd < lastDate ? chunkEnd : lastDate
    windows.push(
      ...await getAvailableWindows(formatDateKey(chunkStart), formatDateKey(end)),
    )
    chunkStart = addDays(end, 1)
  }

  return windows
}

async function reserveFirstAvailableWindow(
  windows: AvailableWindow[],
): Promise<{ reservation: ReservationHandle; window: AvailableWindow }> {
  for (const window of windows) {
    try {
      return { reservation: await reserveWindow(window.id), window }
    } catch (cause) {
      if (!isWindowUnavailable(cause)) throw cause
    }
  }

  throw new Error('Matching delivery times were just booked. Choose another date or preference.')
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700 sm:text-sm">
      {label}
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-700">{error}</span>}
    </label>
  )
}

function SectionHeading({ id, number, title }: { id: string; number: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#102342] text-xs font-bold text-[#e2c76e]">
        {number}
      </span>
      <h2 id={id} className="font-[Georgia] text-xl text-[#102342] sm:text-[22px]">{title}</h2>
    </div>
  )
}

export function DeliveryRequest() {
  const [draft, setDraft] = useState<DeliveryRequestDraft>(loadDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [availabilityLoadingDate, setAvailabilityLoadingDate] = useState(draft.deliveryDate)
  const [scheduleRules, setScheduleRules] = useState<CustomerSchedulingRules | null>(null)
  const [availableWindows, setAvailableWindows] = useState<AvailableWindow[]>([])
  const [loadingRules, setLoadingRules] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [reservation, setReservation] = useState<ReservationHandle | null>(null)
  const [reservedWindow, setReservedWindow] = useState<AvailableWindow | null>(null)
  const [reservationWarning, setReservationWarning] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    getCustomerSchedulingRules()
      .then((rules) => {
        if (active) setScheduleRules(rules)
      })
      .catch((cause: unknown) => {
        if (active) setScheduleError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoadingRules(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (
      !scheduleRules
      || !draft.deliveryPreference
      || !draft.deliveryDate
      || draft.deliveryPreference === 'appointment_delivery'
    ) {
      return
    }

    let active = true
    getAvailableWindows(draft.deliveryDate, draft.deliveryDate)
      .then((windows) => {
        if (active) setAvailableWindows(windows)
      })
      .catch((cause: unknown) => {
        if (active) setScheduleError(errorMessage(cause))
      })
      .finally(() => {
        if (active) {
          setAvailabilityLoadingDate((current) =>
            current === draft.deliveryDate ? '' : current,
          )
        }
      })

    return () => {
      active = false
    }
  }, [scheduleRules, draft.deliveryDate, draft.deliveryPreference])
  const loadingWindows = Boolean(
    scheduleRules
      && draft.deliveryPreference
      && draft.deliveryDate
      && draft.deliveryPreference !== 'appointment_delivery'
      && availabilityLoadingDate === draft.deliveryDate,
  )

  const scheduleToday = scheduleRules
    ? dateInTimeZone(scheduleRules.time_zone, new Date(now))
    : localDateKey(new Date(now))
  const minimumDeliveryDate = scheduleRules
    ? dateInTimeZone(
        scheduleRules.time_zone,
        new Date(now + scheduleRules.minimum_advance_minutes * 60_000),
      )
    : scheduleToday
  const maximumDeliveryDate = scheduleRules
    ? formatDateKey(
        addDays(parseDateKey(scheduleToday), scheduleRules.maximum_advance_days),
      )
    : undefined

  function updateField<K extends keyof DeliveryRequestDraft>(
    field: K,
    value: DeliveryRequestDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaved(false)
    setScheduleError(null)
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function updateDeliveryDate(value: string) {
    setDraft((current) => ({ ...current, deliveryDate: value, deliveryWindowId: '' }))
    setAvailabilityLoadingDate(
      draft.deliveryPreference === 'appointment_delivery' ? '' : value,
    )
    setAvailableWindows([])
    setReservation(null)
    setReservedWindow(null)
    setReservationWarning(null)
    setScheduleError(null)
    setSaved(false)
    setErrors((current) => {
      const next = { ...current }
      delete next.deliveryDate
      delete next.deliveryWindowId
      return next
    })
  }

  function updateDeliveryPreference(preference: DeliveryPreference) {
    const deliveryDate = preference === 'earliest_available' ? '' : draft.deliveryDate
    setDraft((current) => ({
      ...current,
      deliveryPreference: preference,
      deliveryDate,
      deliveryWindowId: '',
    }))
    setAvailabilityLoadingDate(
      preference !== 'earliest_available' && preference !== 'appointment_delivery'
        ? deliveryDate
        : '',
    )
    setAvailableWindows([])
    setReservation(null)
    setReservedWindow(null)
    setReservationWarning(null)
    setScheduleError(null)
    setSaved(false)
    setErrors((current) => {
      const next = { ...current }
      delete next.deliveryPreference
      delete next.deliveryDate
      delete next.deliveryWindowId
      return next
    })
  }

  const matchingWindows = scheduleRules
    ? windowsForPreference(draft.deliveryPreference, availableWindows, scheduleRules.time_zone)
    : []

  function validate() {
    const nextErrors: Record<string, string> = {}
    if (!draft.pickupAddress.trim()) nextErrors.pickupAddress = 'Enter the pickup address.'
    if (!draft.pickupContactName.trim()) nextErrors.pickupContactName = 'Enter a contact name.'
    if (!draft.pickupContactPhone.trim()) nextErrors.pickupContactPhone = 'Enter a contact phone number.'
    if (!draft.destinationAddress.trim()) nextErrors.destinationAddress = 'Enter the destination address.'
    if (!draft.recipientName.trim()) nextErrors.recipientName = 'Enter the recipient name.'
    if (!draft.recipientPhone.trim()) nextErrors.recipientPhone = 'Enter the recipient phone number.'
    if (!draft.deliveryPreference) {
      nextErrors.deliveryPreference = 'Choose a delivery preference.'
    }
    if (draft.deliveryPreference && draft.deliveryPreference !== 'earliest_available') {
      if (!draft.deliveryDate) nextErrors.deliveryDate = 'Choose a requested delivery date.'
      else if (draft.deliveryDate < minimumDeliveryDate) {
        nextErrors.deliveryDate = 'Choose today or a future date.'
      } else if (maximumDeliveryDate && draft.deliveryDate > maximumDeliveryDate) {
        nextErrors.deliveryDate = 'Choose a date within the available booking range.'
      }
    }
    if (draft.deliveryPreference === 'specific_two_hour_window') {
      if (
        !draft.deliveryWindowId
        || !matchingWindows.some((window) => window.id === draft.deliveryWindowId)
      ) {
        nextErrors.deliveryWindowId = 'Select an available two-hour window.'
      }
    } else if (
      draft.deliveryPreference
      && draft.deliveryPreference !== 'earliest_available'
      && draft.deliveryPreference !== 'appointment_delivery'
      && draft.deliveryDate
      && !loadingWindows
      && matchingWindows.length === 0
    ) {
      nextErrors.deliveryWindowId = 'No available time matches this preference. Choose another date or preference.'
    }
    if (!draft.description.trim()) nextErrors.description = 'Describe the package.'
    if (!draft.weightPounds.trim() || !Number.isFinite(Number(draft.weightPounds)) || Number(draft.weightPounds) <= 0) {
      nextErrors.weightPounds = 'Enter a weight greater than zero.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    setScheduleError(null)
    try {
      if (!scheduleRules) {
        throw new Error('Scheduling is not configured. Please try again later.')
      }

      if (draft.deliveryPreference === 'appointment_delivery') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
        } catch (cause) {
          throw new Error(`Your appointment preference could not be saved in this browser: ${errorMessage(cause)}`)
        }
        setSaved(true)
        return
      }

      let candidates = draft.deliveryPreference === 'earliest_available'
        ? await findEarliestAvailableWindows(minimumDeliveryDate, maximumDeliveryDate ?? minimumDeliveryDate)
        : matchingWindows
      if (draft.deliveryPreference === 'specific_two_hour_window') {
        candidates = candidates.filter((window) => window.id === draft.deliveryWindowId)
      }
      if (candidates.length === 0) {
        throw new Error('No matching delivery time is available. Choose another date or preference.')
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch (cause) {
        throw new Error(`Your delivery details could not be saved in this browser: ${errorMessage(cause)}`)
      }

      const { reservation: hold, window } = await reserveFirstAvailableWindow(candidates)
      setReservation(hold)
      setReservedWindow(window)
      const warnings: string[] = []
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...draft,
            deliveryDate: draft.deliveryDate || window.service_date,
            deliveryWindowId: window.id,
          }),
        )
      } catch {
        warnings.push('Your time is held, but this browser could not save the selected window with the request details.')
      }
      try {
        sessionStorage.setItem(
          `tamay-schedule-reservation:${hold.reservation_id}`,
          hold.reservation_token,
        )
      } catch {
        warnings.push('This browser could not store the secure reservation token. Keep this page open while continuing.')
      }
      if (warnings.length > 0) setReservationWarning(warnings.join(' '))
      setSaved(true)
    } catch (cause) {
      setScheduleError(errorMessage(cause))
      if (draft.deliveryDate && draft.deliveryPreference !== 'appointment_delivery') {
        try {
          const windows = await getAvailableWindows(draft.deliveryDate, draft.deliveryDate)
          setAvailableWindows(windows)
          if (!windowsForPreference(
            draft.deliveryPreference,
            windows,
            scheduleRules?.time_zone ?? '',
          ).some((window) => window.id === draft.deliveryWindowId)) {
            setDraft((current) => ({ ...current, deliveryWindowId: '' }))
          }
        } catch (refreshCause) {
          setScheduleError(
            `${errorMessage(cause)} Availability could not be refreshed: ${errorMessage(refreshCause)}`,
          )
        }
      }
    } finally {
      setSaving(false)
    }
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY)
    setDraft(initialDraft)
    setAvailabilityLoadingDate('')
    setAvailableWindows([])
    setErrors({})
    setSaved(false)
    setReservation(null)
    setReservedWindow(null)
    setReservationWarning(null)
    setScheduleError(null)
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-9">
      <div className="mb-5 sm:mb-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[#8c7117] sm:text-xs">
          Delivery request
        </p>
        <h1 className="mt-1.5 font-[Georgia] text-[27px] leading-tight text-[#102342] sm:text-3xl">
          Tell us about your delivery
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Choose when you need the delivery, then share pickup, destination, and package
          details. You can review your options before confirming.
        </p>
      </div>

      <form
        onSubmit={saveDraft}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(16,35,66,0.07)]"
      >
        <fieldset disabled={saving || Boolean(reservation)} className="m-0 min-w-0 border-0 p-0">
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-7">
          <section aria-labelledby="delivery-schedule-heading">
            <SectionHeading id="delivery-schedule-heading" number="01" title="Delivery schedule" />
            {!supabaseConfiguration.isComplete ? (
              <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Live delivery times are unavailable until Supabase is connected and company scheduling is configured.
              </p>
            ) : scheduleError ? (
              <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {scheduleError}
              </p>
            ) : null}
            {loadingRules && (
              <p role="status" className="mb-3 text-sm text-slate-600">Loading delivery options…</p>
            )}
            <fieldset
              className="grid gap-2 sm:grid-cols-2"
              aria-describedby={errors.deliveryPreference ? 'delivery-preference-error' : undefined}
            >
              <legend className="mb-2 text-xs font-semibold text-slate-700 sm:text-sm">
                When should we deliver?
              </legend>
              {deliveryPreferenceOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                    draft.deliveryPreference === option.value
                      ? 'border-[#35558f] bg-[#f2f5fa] ring-2 ring-[#35558f]/15'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryPreference"
                    value={option.value}
                    checked={draft.deliveryPreference === option.value}
                    onChange={() => updateDeliveryPreference(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#35558f]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#102342]">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {errors.deliveryPreference && (
              <p id="delivery-preference-error" role="alert" className="mt-2 text-xs font-medium text-rose-700">
                {errors.deliveryPreference}
              </p>
            )}
            {draft.deliveryPreference && draft.deliveryPreference !== 'earliest_available' && (
              <div className="mb-4 max-w-sm">
                <FormField
                  label="Requested delivery date"
                  error={errors.deliveryDate}
                >
                  <input
                    className={fieldClass}
                    type="date"
                    min={minimumDeliveryDate}
                    max={maximumDeliveryDate}
                    value={draft.deliveryDate}
                    onChange={(event) => updateDeliveryDate(event.target.value)}
                    aria-invalid={Boolean(errors.deliveryDate)}
                    disabled={loadingRules || !scheduleRules || Boolean(reservation)}
                    required
                  />
                </FormField>
                {scheduleRules && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Available dates use {scheduleRules.time_zone}.
                  </p>
                )}
              </div>
            )}
            {draft.deliveryPreference === 'earliest_available' && (
              <p className="mb-4 text-sm leading-6 text-slate-600">
                We’ll search the configured schedule and hold the soonest available delivery time
                when you save the request.
              </p>
            )}
            {draft.deliveryPreference === 'appointment_delivery' && (
              <p className="mb-4 text-sm leading-6 text-slate-600">
                No time is held for an appointment. This preview saves the preference in this
                browser only; it is not sent to the company for coordination yet.
              </p>
            )}
            {draft.deliveryDate && draft.deliveryPreference !== 'appointment_delivery' && (
              <div className="mb-4" aria-live="polite">
                {loadingWindows ? (
                  <p role="status" className="text-sm text-slate-600">Checking available delivery times…</p>
                ) : draft.deliveryPreference === 'specific_two_hour_window' ? (
                  <>
                    <fieldset aria-describedby={errors.deliveryWindowId ? 'delivery-window-error' : undefined}>
                      <legend className="text-xs font-semibold text-slate-700 sm:text-sm">
                        Choose an available two-hour window
                      </legend>
                      {matchingWindows.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">
                          No two-hour windows are available on this date. Choose another date.
                        </p>
                      ) : (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {matchingWindows.map((window) => (
                            <label
                              key={window.id}
                              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 transition ${
                                draft.deliveryWindowId === window.id
                                  ? 'border-[#35558f] bg-[#f2f5fa] ring-2 ring-[#35558f]/15'
                                  : 'border-slate-300 bg-white hover:border-slate-400'
                              }`}
                            >
                              <input
                                type="radio"
                                name="deliveryWindow"
                                value={window.id}
                                checked={draft.deliveryWindowId === window.id}
                                onChange={() => updateField('deliveryWindowId', window.id)}
                                className="h-4 w-4 accent-[#35558f]"
                              />
                              <span className="text-sm font-bold text-[#102342]">
                                {formatWindowTime(window.starts_at, scheduleRules?.time_zone)}
                                {' – '}
                                {formatWindowTime(window.ends_at, scheduleRules?.time_zone)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                    {errors.deliveryWindowId && (
                      <p id="delivery-window-error" role="alert" className="mt-2 text-xs font-medium text-rose-700">
                        {errors.deliveryWindowId}
                      </p>
                    )}
                  </>
                ) : matchingWindows.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No available times match this preference on the selected date. Choose another date or delivery preference.
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    {draft.deliveryPreference === 'specific_date'
                      ? 'An available time exists on this date; the earliest open window will be held when you save.'
                      : `${matchingWindows.length} available window${matchingWindows.length === 1 ? '' : 's'} match this preference. The earliest match will be held when you save.`}
                    {matchingWindows[0] && scheduleRules && (
                      <span className="mt-1 block font-semibold text-[#102342]">
                        Earliest matching window:{' '}
                        {formatWindowTime(matchingWindows[0].starts_at, scheduleRules.time_zone)}
                        {' – '}
                        {formatWindowTime(matchingWindows[0].ends_at, scheduleRules.time_zone)}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
            {reservation && reservedWindow && scheduleRules && (
              <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                Temporarily assigned:{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeZone: 'UTC',
                }).format(new Date(`${reservedWindow.service_date}T00:00:00Z`))},{' '}
                {formatWindowTime(reservedWindow.starts_at, scheduleRules.time_zone)}–
                {formatWindowTime(reservedWindow.ends_at, scheduleRules.time_zone)}.
              </p>
            )}
            {errors.deliveryWindowId && draft.deliveryPreference !== 'specific_two_hour_window' && (
              <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
                {errors.deliveryWindowId}
              </p>
            )}
          </section>

          <section aria-labelledby="pickup-heading">
            <SectionHeading id="pickup-heading" number="02" title="Pickup" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
              <div className="col-span-2">
                <FormField label="Pickup address" error={errors.pickupAddress}>
                  <input
                    className={fieldClass}
                    autoComplete="street-address"
                    value={draft.pickupAddress}
                    onChange={(event) => updateField('pickupAddress', event.target.value)}
                    placeholder="Street, city, state, ZIP code"
                    aria-invalid={Boolean(errors.pickupAddress)}
                  />
                </FormField>
              </div>
              <FormField label="Contact name" error={errors.pickupContactName}>
                <input
                  className={fieldClass}
                  autoComplete="name"
                  value={draft.pickupContactName}
                  onChange={(event) => updateField('pickupContactName', event.target.value)}
                  aria-invalid={Boolean(errors.pickupContactName)}
                />
              </FormField>
              <FormField label="Contact phone" error={errors.pickupContactPhone}>
                <input
                  className={fieldClass}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={draft.pickupContactPhone}
                  onChange={(event) => updateField('pickupContactPhone', event.target.value)}
                  aria-invalid={Boolean(errors.pickupContactPhone)}
                />
              </FormField>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 sm:pt-6" aria-labelledby="destination-heading">
            <SectionHeading id="destination-heading" number="03" title="Destination" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
              <div className="col-span-2">
                <FormField label="Destination address" error={errors.destinationAddress}>
                  <input
                    className={fieldClass}
                    autoComplete="street-address"
                    value={draft.destinationAddress}
                    onChange={(event) => updateField('destinationAddress', event.target.value)}
                    placeholder="Street, city, state, ZIP code"
                    aria-invalid={Boolean(errors.destinationAddress)}
                  />
                </FormField>
              </div>
              <FormField label="Recipient name" error={errors.recipientName}>
                <input
                  className={fieldClass}
                  autoComplete="name"
                  value={draft.recipientName}
                  onChange={(event) => updateField('recipientName', event.target.value)}
                  aria-invalid={Boolean(errors.recipientName)}
                />
              </FormField>
              <FormField label="Recipient phone" error={errors.recipientPhone}>
                <input
                  className={fieldClass}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={draft.recipientPhone}
                  onChange={(event) => updateField('recipientPhone', event.target.value)}
                  aria-invalid={Boolean(errors.recipientPhone)}
                />
              </FormField>
            </div>
          </section>
          <section className="border-t border-slate-200 pt-5 sm:pt-6" aria-labelledby="package-heading">
            <SectionHeading id="package-heading" number="04" title="Package" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4">
              <FormField label="Package category">
                <select
                  className={fieldClass}
                  value={draft.packageCategory}
                  onChange={(event) => updateField('packageCategory', event.target.value as PackageCategory)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Package description" error={errors.description}>
                <input
                  className={fieldClass}
                  value={draft.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="Example: boxed tool set"
                  aria-invalid={Boolean(errors.description)}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
                {[
                  ['lengthInches', 'Length', 'in'],
                  ['widthInches', 'Width', 'in'],
                  ['heightInches', 'Height', 'in'],
                  ['weightPounds', 'Weight', 'lb'],
                ].map(([field, label, unit]) => (
                  <FormField
                    key={field}
                    label={`${label} (${unit})`}
                    error={field === 'weightPounds' ? errors.weightPounds : undefined}
                  >
                    <input
                      className={fieldClass}
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={draft[field as keyof DeliveryRequestDraft]}
                      onChange={(event) =>
                        updateField(field as keyof DeliveryRequestDraft, event.target.value)
                      }
                      aria-invalid={field === 'weightPounds' && Boolean(errors.weightPounds)}
                    />
                  </FormField>
                ))}
              </div>
              <FormField label="Special handling (optional)">
                <textarea
                  className={`${fieldClass} min-h-20 resize-y`}
                  value={draft.specialHandling}
                  onChange={(event) => updateField('specialHandling', event.target.value)}
                  placeholder="Fragile items, loading assistance, or other instructions"
                />
              </FormField>
            </div>
          </section>
        </div>
        </fieldset>

        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-4 md:px-7">
          <div className="mb-3 min-h-5 sm:mb-0">
            {saved && reservation && reservedWindow && scheduleRules ? (
              <div role="status" className="text-sm font-semibold text-emerald-700">
                <p>
                  Your {deliveryPreferenceOptions.find((option) => option.value === draft.deliveryPreference)?.label}
                  {' '}preference is scheduled for{' '}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(new Date(`${reservedWindow.service_date}T00:00:00Z`))}
                  {' at '}
                  {formatWindowTime(reservedWindow.starts_at, scheduleRules.time_zone)}
                  {' – '}
                  {formatWindowTime(reservedWindow.ends_at, scheduleRules.time_zone)} and held until{' '}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: scheduleRules?.time_zone,
                  }).format(new Date(reservation.expires_at))}
                  .
                </p>
                <p className="mt-1 text-xs font-normal text-slate-600">
                  Checkout is not connected yet. Complete your request before the hold expires.
                </p>
                {reservationWarning && (
                  <p className="mt-1 text-xs font-normal text-amber-800">{reservationWarning}</p>
                )}
              </div>
            ) : saved && draft.deliveryPreference === 'appointment_delivery' ? (
              <p role="status" className="text-sm font-semibold text-emerald-700">
                Appointment preference saved in this browser. No delivery window is held; staff
                coordination and request submission are not connected yet.
              </p>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                Your details stay in this browser. Non-appointment choices hold a matching delivery time when saved.
              </p>
            )}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={clearDraft}
              disabled={saving || Boolean(reservation)}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={
                saving
                || Boolean(reservation)
                || loadingRules
                || !scheduleRules
                || loadingWindows
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#102342] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a355c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving
                ? 'Saving delivery request…'
                : reservation
                  ? 'Delivery time held'
                  : draft.deliveryPreference === 'appointment_delivery'
                    ? 'Save appointment preference'
                    : 'Save details & hold time'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </form>

      <p className="mx-auto mt-4 flex max-w-4xl items-start gap-2 px-1 text-xs leading-5 text-slate-500">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#35558f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5.5c0 4.2 3.2 7.7 7.5 9.5 4.3-1.8 7.5-5.3 7.5-9.5V6L12 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
        </svg>
        No payment is collected on this page. Delivery details are stored in this browser, and the selected window is temporarily held by the scheduling service.
      </p>
    </main>
  )
}
