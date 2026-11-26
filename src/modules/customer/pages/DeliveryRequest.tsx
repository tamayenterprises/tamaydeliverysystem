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
import type { DeliveryRequestDraft, PackageCategory } from '../types/deliveryRequest'

const STORAGE_KEY = 'tamay-delivery-request-draft'

const initialDraft: DeliveryRequestDraft = {
  pickupAddress: '',
  pickupContactName: '',
  pickupContactPhone: '',
  destinationAddress: '',
  recipientName: '',
  recipientPhone: '',
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
    if (!scheduleRules || !draft.deliveryDate) {
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
  }, [scheduleRules, draft.deliveryDate])
  const loadingWindows = Boolean(
    scheduleRules
      && draft.deliveryDate
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
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function updateDeliveryDate(value: string) {
    setDraft((current) => ({ ...current, deliveryDate: value, deliveryWindowId: '' }))
    setAvailabilityLoadingDate(value)
    setAvailableWindows([])
    setReservation(null)
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

  function validate() {
    const nextErrors: Record<string, string> = {}
    if (!draft.pickupAddress.trim()) nextErrors.pickupAddress = 'Enter the pickup address.'
    if (!draft.pickupContactName.trim()) nextErrors.pickupContactName = 'Enter a contact name.'
    if (!draft.pickupContactPhone.trim()) nextErrors.pickupContactPhone = 'Enter a contact phone number.'
    if (!draft.destinationAddress.trim()) nextErrors.destinationAddress = 'Enter the destination address.'
    if (!draft.recipientName.trim()) nextErrors.recipientName = 'Enter the recipient name.'
    if (!draft.recipientPhone.trim()) nextErrors.recipientPhone = 'Enter the recipient phone number.'
    if (!draft.deliveryDate) nextErrors.deliveryDate = 'Choose a requested delivery date.'
    else if (draft.deliveryDate < minimumDeliveryDate) {
      nextErrors.deliveryDate = 'Choose today or a future date.'
    } else if (maximumDeliveryDate && draft.deliveryDate > maximumDeliveryDate) {
      nextErrors.deliveryDate = 'Choose a date within the available booking range.'
    }
    if (
      !draft.deliveryWindowId
      || !availableWindows.some((window) => window.id === draft.deliveryWindowId)
    ) {
      nextErrors.deliveryWindowId = 'Select an available delivery time.'
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (cause) {
      setScheduleError(`Your delivery details could not be saved in this browser: ${errorMessage(cause)}`)
      setSaving(false)
      return
    }

    try {
      const hold = await reserveWindow(draft.deliveryWindowId)
      setReservation(hold)
      try {
        sessionStorage.setItem(`tamay-schedule-reservation:${hold.reservation_id}`, hold.reservation_token)
      } catch {
        setReservationWarning('Your delivery window is held, but this browser could not store its secure reservation token. Keep this page open while continuing.')
      }
      setSaved(true)
    } catch (cause) {
      setScheduleError(
        `Your details were saved on this device, but the selected time could not be held: ${errorMessage(cause)}`,
      )
      try {
        const windows = await getAvailableWindows(draft.deliveryDate, draft.deliveryDate)
        setAvailableWindows(windows)
        if (!windows.some((window) => window.id === draft.deliveryWindowId)) {
          setDraft((current) => ({ ...current, deliveryWindowId: '' }))
        }
      } catch (refreshCause) {
        setScheduleError(
          `Your details were saved, but the time could not be held or refreshed. ${errorMessage(cause)} ${errorMessage(refreshCause)}`,
        )
      }
    } finally {
      setSaving(false)
    }
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY)
    setDraft(initialDraft)
    setErrors({})
    setSaved(false)
    setReservation(null)
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
          <section aria-labelledby="delivery-date-heading">
            <SectionHeading id="delivery-date-heading" number="01" title="Delivery schedule" />
            {!supabaseConfiguration.isComplete ? (
              <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Live delivery times are unavailable until Supabase is connected and company scheduling is configured.
              </p>
            ) : scheduleError ? (
              <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {scheduleError}
              </p>
            ) : null}
            <div className="max-w-xl">
              <FormField label="Requested pickup date" error={errors.deliveryDate}>
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
                  Times shown in {scheduleRules.time_zone}. Choose the date you need us to pick up
                  your package, then select an available window.
                </p>
              )}
            </div>

            <fieldset className="mt-4" aria-describedby={errors.deliveryWindowId ? 'delivery-window-error' : undefined}>
              <legend className="text-xs font-semibold text-slate-700 sm:text-sm">
                Available pickup windows
              </legend>
              {!draft.deliveryDate ? (
                <p className="mt-2 text-sm text-slate-500">Choose a date to see available times.</p>
              ) : loadingRules || loadingWindows ? (
                <p role="status" className="mt-2 text-sm text-slate-600">Loading available times…</p>
              ) : availableWindows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  No pickup windows are available for this date. Choose another date.
                </p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {availableWindows.map((window) => (
                    <label
                      key={window.id}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 transition ${
                        draft.deliveryWindowId === window.id
                          ? 'border-[#35558f] bg-[#f2f5fa] ring-2 ring-[#35558f]/15'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      } ${reservation ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <input
                        type="radio"
                        name="deliveryWindow"
                        value={window.id}
                        checked={draft.deliveryWindowId === window.id}
                        onChange={() => updateField('deliveryWindowId', window.id)}
                        disabled={saving || Boolean(reservation)}
                        required
                        className="h-4 w-4 accent-[#35558f]"
                      />
                      <span>
                        <span className="block text-sm font-bold text-[#102342]">
                          {formatWindowTime(window.starts_at, scheduleRules?.time_zone)}
                          {' – '}
                          {formatWindowTime(window.ends_at, scheduleRules?.time_zone)}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {window.remaining_capacity}{' '}
                          {window.remaining_capacity === 1 ? 'spot' : 'spots'} available
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.deliveryWindowId && (
                <p id="delivery-window-error" role="alert" className="mt-2 text-xs font-medium text-rose-700">
                  {errors.deliveryWindowId}
                </p>
              )}
            </fieldset>
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
            {saved && reservation ? (
              <div role="status" className="text-sm font-semibold text-emerald-700">
                <p>
                  Your details are saved and your delivery window is held until{' '}
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
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                Your details are saved on this device when you hold a delivery time.
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
              disabled={saving || Boolean(reservation)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#102342] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a355c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving ? 'Holding delivery time…' : reservation ? 'Delivery time held' : 'Save request & hold time'}
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
