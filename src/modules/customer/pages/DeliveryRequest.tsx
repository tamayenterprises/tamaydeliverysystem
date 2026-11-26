import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
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
  const [minimumDeliveryDate] = useState(localDateKey)

  function updateField<K extends keyof DeliveryRequestDraft>(
    field: K,
    value: DeliveryRequestDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaved(false)
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
    }
    if (!draft.description.trim()) nextErrors.description = 'Describe the package.'
    if (!draft.weightPounds.trim() || !Number.isFinite(Number(draft.weightPounds)) || Number(draft.weightPounds) <= 0) {
      nextErrors.weightPounds = 'Enter a weight greater than zero.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate()) return

    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setSaved(true)
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY)
    setDraft(initialDraft)
    setErrors({})
    setSaved(false)
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
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-7">
          <section aria-labelledby="pickup-heading">
            <SectionHeading id="pickup-heading" number="01" title="Pickup" />
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
            <SectionHeading id="destination-heading" number="02" title="Destination" />
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
          <section className="border-t border-slate-200 pt-5 sm:pt-6" aria-labelledby="delivery-date-heading">
            <SectionHeading id="delivery-date-heading" number="03" title="Delivery date" />
            <div className="max-w-sm">
              <FormField label="Requested delivery date" error={errors.deliveryDate}>
                <input
                  className={fieldClass}
                  type="date"
                  min={minimumDeliveryDate}
                  value={draft.deliveryDate}
                  onChange={(event) => updateField('deliveryDate', event.target.value)}
                  aria-invalid={Boolean(errors.deliveryDate)}
                  required
                />
              </FormField>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Choose the date you need us to pick up your package for delivery. Final timing
                depends on availability.
              </p>
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

        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-4 md:px-7">
          <div className="mb-3 min-h-5 sm:mb-0">
            {saved ? (
              <p role="status" className="text-sm font-semibold text-emerald-700">
                Your delivery draft has been saved on this device.
              </p>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                Your draft stays on this device until you continue.
              </p>
            )}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f]"
            >
              Clear
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#102342] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1a355c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#35558f] sm:flex-none"
            >
              Save delivery details
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
        No payment is collected on this page. Your delivery details are only saved locally in this browser.
      </p>
    </main>
  )
}
