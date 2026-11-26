import { useState } from 'react'
import type { FormEvent } from 'react'
import type { DeliveryRequestDraft, PackageCategory } from '../types/deliveryRequest'

const STORAGE_KEY = 'tamay-delivery-request-draft'

const initialDraft: DeliveryRequestDraft = {
  pickupAddress: '',
  pickupContactName: '',
  pickupContactPhone: '',
  destinationAddress: '',
  recipientName: '',
  recipientPhone: '',
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

export function DeliveryRequest() {
  const [draft, setDraft] = useState<DeliveryRequestDraft>(loadDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  function updateField<K extends keyof DeliveryRequestDraft>(
    field: K,
    value: DeliveryRequestDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    if (!draft.pickupAddress.trim()) nextErrors.pickupAddress = 'Pickup address is required.'
    if (!draft.pickupContactName.trim()) nextErrors.pickupContactName = 'Pickup contact name is required.'
    if (!draft.pickupContactPhone.trim()) nextErrors.pickupContactPhone = 'Pickup contact phone is required.'
    if (!draft.destinationAddress.trim()) nextErrors.destinationAddress = 'Destination address is required.'
    if (!draft.recipientName.trim()) nextErrors.recipientName = 'Recipient name is required.'
    if (!draft.recipientPhone.trim()) nextErrors.recipientPhone = 'Recipient phone is required.'
    if (!draft.description.trim()) nextErrors.description = 'Package description is required.'
    if (!draft.weightPounds.trim() || Number(draft.weightPounds) <= 0) {
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

  const categoryOptions: Array<{ value: PackageCategory; label: string }> = [
    { value: 'box', label: 'Box or parcel' },
    { value: 'envelope', label: 'Envelope or document' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'appliance', label: 'Appliance' },
    { value: 'construction', label: 'Construction material' },
    { value: 'other', label: 'Other' },
  ]

  const fieldClass = 'mt-1.5 w-full rounded-sm border border-[#35558f]/25 bg-white px-3 py-2 text-sm text-[#0b1628] outline-none transition placeholder:text-slate-400 focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20'

  return (
    <main className="mx-auto max-w-6xl px-5 py-7 sm:px-6 sm:py-8">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c9a227]">
          Delivery request
        </p>
        <h1 className="mt-1 font-[Georgia] text-3xl text-white">Package and address details</h1>
        <p className="mt-2 text-sm text-white/70">
          This draft is stored only in this browser until the secure checkout workflow is available.
        </p>
      </div>

      <form onSubmit={saveDraft} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-[#35558f]/30 bg-[#f8f8f5] p-4 text-[#0b1628] shadow-lg">
          <h2 className="font-[Georgia] text-xl">Pickup</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="md:col-span-2">
              Pickup address
              <input
                className={fieldClass}
                value={draft.pickupAddress}
                onChange={(event) => updateField('pickupAddress', event.target.value)}
                placeholder="Street, city, state, postal code"
              />
              {errors.pickupAddress && <span className="mt-2 block text-sm text-rose-400">{errors.pickupAddress}</span>}
            </label>
            <label>
              Contact name
              <input
                className={fieldClass}
                value={draft.pickupContactName}
                onChange={(event) => updateField('pickupContactName', event.target.value)}
              />
              {errors.pickupContactName && <span className="mt-2 block text-sm text-rose-400">{errors.pickupContactName}</span>}
            </label>
            <label>
              Contact phone
              <input
                className={fieldClass}
                type="tel"
                value={draft.pickupContactPhone}
                onChange={(event) => updateField('pickupContactPhone', event.target.value)}
              />
              {errors.pickupContactPhone && <span className="mt-2 block text-sm text-rose-400">{errors.pickupContactPhone}</span>}
            </label>
          </div>
        </section>

        <section className="rounded-sm border border-[#35558f]/30 bg-[#f8f8f5] p-4 text-[#0b1628] shadow-lg">
          <h2 className="font-[Georgia] text-xl">Destination</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="md:col-span-2">
              Destination address
              <input
                className={fieldClass}
                value={draft.destinationAddress}
                onChange={(event) => updateField('destinationAddress', event.target.value)}
                placeholder="Street, city, state, postal code"
              />
              {errors.destinationAddress && <span className="mt-2 block text-sm text-rose-400">{errors.destinationAddress}</span>}
            </label>
            <label>
              Recipient name
              <input
                className={fieldClass}
                value={draft.recipientName}
                onChange={(event) => updateField('recipientName', event.target.value)}
              />
              {errors.recipientName && <span className="mt-2 block text-sm text-rose-400">{errors.recipientName}</span>}
            </label>
            <label>
              Recipient phone
              <input
                className={fieldClass}
                type="tel"
                value={draft.recipientPhone}
                onChange={(event) => updateField('recipientPhone', event.target.value)}
              />
              {errors.recipientPhone && <span className="mt-2 block text-sm text-rose-400">{errors.recipientPhone}</span>}
            </label>
          </div>
        </section>
        </div>

        <section className="rounded-sm border border-[#35558f]/30 bg-[#f8f8f5] p-4 text-[#0b1628] shadow-lg">
          <h2 className="font-[Georgia] text-xl">Package</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-12">
            <label className="md:col-span-3">
              Package category
              <select
                className={fieldClass}
                value={draft.packageCategory}
                onChange={(event) => updateField('packageCategory', event.target.value as PackageCategory)}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="md:col-span-9">
              Description
              <input
                className={fieldClass}
                value={draft.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Example: one 50 lb boxed tool set"
              />
              {errors.description && <span className="mt-2 block text-sm text-rose-400">{errors.description}</span>}
            </label>
            {[
              ['lengthInches', 'Length (inches)'],
              ['widthInches', 'Width (inches)'],
              ['heightInches', 'Height (inches)'],
              ['weightPounds', 'Weight (lb)'],
            ].map(([field, label]) => (
              <label key={field} className="md:col-span-3">
                {label}
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft[field as keyof DeliveryRequestDraft]}
                  onChange={(event) => updateField(field as keyof DeliveryRequestDraft, event.target.value)}
                />
                {field === 'weightPounds' && errors.weightPounds && (
                  <span className="mt-2 block text-sm text-rose-400">{errors.weightPounds}</span>
                )}
              </label>
            ))}
            <label className="md:col-span-12">
              Special handling
              <textarea
                className={`${fieldClass} min-h-16 resize-y`}
                value={draft.specialHandling}
                onChange={(event) => updateField('specialHandling', event.target.value)}
                placeholder="Loading assistance, fragile items, weather protection, etc."
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-sm bg-[#c9a227] px-5 py-3 font-bold text-[#0b1628] transition hover:bg-[#dfbd4f]"
          >
            Save delivery draft
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-sm border border-white/35 px-5 py-3 font-semibold text-white transition hover:border-[#c9a227]"
          >
            Clear
          </button>
          {saved && (
            <p role="status" className="text-sm font-medium text-emerald-400">
              Delivery draft saved.
            </p>
          )}
        </div>
      </form>
    </main>
  )
}
