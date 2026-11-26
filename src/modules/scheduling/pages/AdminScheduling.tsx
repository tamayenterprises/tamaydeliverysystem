import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  formatDateKey,
  formatDayName,
  formatRangeLabel,
  formatTimeInput,
  formatWindowTime,
  getCalendarDates,
  getCalendarRange,
  parseDateKey,
  shiftCalendarDate,
  weekdayNames,
} from '../utils/calendar'
import { getWindowAvailability } from '../utils/capacity'
import type {
  AdminScheduleData,
  CalendarView,
  OperatingHours,
  Weekday,
  WindowTemplate,
} from '../types/scheduling'
import {
  createCompanyClosure,
  loadAdminSchedule,
  releaseReservation,
  removeCompanyClosure,
  saveOperatingHours,
  saveSchedulingSettings,
  saveWindowTemplate,
  setWindowTemplateEnabled,
} from '../services/schedulingService'
import { supabaseConfiguration } from '../../../services/supabase/client'

type AdminTab = 'calendar' | 'hours' | 'windows' | 'closures' | 'reservations'
type HoursDraft = Omit<OperatingHours, 'updated_at'>
type WindowDraft = {
  weekday: string
  label: string
  starts_at: string
  ends_at: string
  maximum_capacity: string
  is_enabled: boolean
}
type SettingsDraft = {
  time_zone: string
  minimum_advance_minutes: string
  maximum_advance_days: string
  reservation_hold_minutes: string
}
type ClosureDraft = {
  closure_date: string
  is_all_day: boolean
  starts_at: string
  ends_at: string
  reason: string
}

const initialWindowDraft: WindowDraft = {
  weekday: '',
  label: '',
  starts_at: '',
  ends_at: '',
  maximum_capacity: '',
  is_enabled: true,
}

const initialSettingsDraft: SettingsDraft = {
  time_zone: '',
  minimum_advance_minutes: '',
  maximum_advance_days: '',
  reservation_hold_minutes: '',
}

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#12233d] outline-none focus:border-[#35558f] focus:ring-2 focus:ring-[#35558f]/15'
const tabLabels: Array<{ id: AdminTab; label: string }> = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'hours', label: 'Operating hours' },
  { id: 'windows', label: 'Delivery windows' },
  { id: 'closures', label: 'Closures & rules' },
  { id: 'reservations', label: 'Reservations' },
]

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The scheduling request failed.'
}

function buildHoursDraft(hours: OperatingHours[]): HoursDraft[] {
  return weekdayNames.map((_, weekday) => {
    const saved = hours.find((item) => item.weekday === weekday)
    return {
      weekday: weekday as Weekday,
      is_open: saved?.is_open ?? false,
      opens_at: saved?.opens_at ?? null,
      closes_at: saved?.closes_at ?? null,
    }
  })
}

function getLocalToday(): string {
  return formatDateKey(new Date())
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#102342]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  )
}

function SectionCard({
  title,
  detail,
  children,
}: {
  title: string
  detail?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="font-[Georgia] text-xl text-[#102342]">{title}</h2>
        {detail && <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
      {children}
    </p>
  )
}

export function AdminScheduling() {
  const [activeTab, setActiveTab] = useState<AdminTab>('calendar')
  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => getLocalToday())
  const [schedule, setSchedule] = useState<AdminScheduleData | null>(null)
  const [hoursDraft, setHoursDraft] = useState<HoursDraft[]>([])
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(initialSettingsDraft)
  const [windowDraft, setWindowDraft] = useState<WindowDraft>(initialWindowDraft)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [closureDraft, setClosureDraft] = useState<ClosureDraft>({
    closure_date: getLocalToday(),
    is_all_day: true,
    starts_at: '',
    ends_at: '',
    reason: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const range = useMemo(() => getCalendarRange(anchorDate, view), [anchorDate, view])
  const startDate = formatDateKey(range.start)
  const endDate = formatDateKey(range.end)

  const applySchedule = useCallback((result: AdminScheduleData) => {
    setSchedule(result)
    setHoursDraft(buildHoursDraft(result.operatingHours))
    if (result.settings) {
      setSettingsDraft({
        time_zone: result.settings.time_zone,
        minimum_advance_minutes: String(result.settings.minimum_advance_minutes),
        maximum_advance_days: String(result.settings.maximum_advance_days),
        reservation_hold_minutes: String(result.settings.reservation_hold_minutes),
      })
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      applySchedule(await loadAdminSchedule(startDate, endDate))
    } catch (cause) {
      setError(messageFrom(cause))
    } finally {
      setLoading(false)
    }
  }, [applySchedule, startDate, endDate])

  useEffect(() => {
    let active = true
    loadAdminSchedule(startDate, endDate)
      .then((result) => {
        if (!active) return
        applySchedule(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFrom(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [applySchedule, startDate, endDate])

  const windowsByDate = useMemo(() => {
    const grouped = new Map<string, AdminScheduleData['windows']>()
    for (const window of schedule?.windows ?? []) {
      const group = grouped.get(window.service_date) ?? []
      group.push(window)
      grouped.set(window.service_date, group)
    }
    return grouped
  }, [schedule?.windows])

  const selectedWindows = windowsByDate.get(selectedDate) ?? []
  const reservationsInView = schedule?.windows.reduce((sum, window) => sum + window.reservation_count, 0) ?? 0
  const confirmedInView = schedule?.windows.reduce((sum, window) => sum + window.confirmed_count, 0) ?? 0
  const remainingInView = schedule?.windows
    .filter((window) => window.is_enabled && !window.is_closed)
    .reduce((sum, window) => sum + window.remaining_capacity, 0) ?? 0
  const fullWindows = schedule?.windows.filter((window) => getWindowAvailability(window) === 'full').length ?? 0
  const calendarDates = useMemo(() => getCalendarDates(anchorDate, view), [anchorDate, view])

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(successMessage)
      await refresh()
    } catch (cause) {
      setError(messageFrom(cause))
    } finally {
      setSaving(false)
    }
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const timeZone = settingsDraft.time_zone.trim()
    const minimumAdvance = Number(settingsDraft.minimum_advance_minutes)
    const maximumAdvance = Number(settingsDraft.maximum_advance_days)
    const holdMinutes = Number(settingsDraft.reservation_hold_minutes)

    try {
      new Intl.DateTimeFormat(undefined, { timeZone })
    } catch {
      setError('Enter a valid IANA time zone, such as America/New_York.')
      return
    }

    if (
      !Number.isInteger(minimumAdvance) || minimumAdvance < 0 ||
      !Number.isInteger(maximumAdvance) || maximumAdvance < 1 ||
      !Number.isInteger(holdMinutes) || holdMinutes < 1 || holdMinutes > 60
    ) {
      setError('Enter valid booking restrictions and a hold duration from 1 to 60 minutes.')
      return
    }

    await runAction(
      () => saveSchedulingSettings({
        id: true,
        time_zone: timeZone,
        minimum_advance_minutes: minimumAdvance,
        maximum_advance_days: maximumAdvance,
        reservation_hold_minutes: holdMinutes,
      }),
      'Booking rules saved.',
    )
  }

  async function submitHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = hoursDraft.find(
      (hours) => hours.is_open && (!hours.opens_at || !hours.closes_at || hours.closes_at <= hours.opens_at),
    )
    if (invalid) {
      setError(`${formatDayName(invalid.weekday)} needs valid opening and closing times.`)
      return
    }

    await runAction(
      () => saveOperatingHours(hoursDraft.map((hours) => ({
        ...hours,
        opens_at: hours.is_open ? hours.opens_at : null,
        closes_at: hours.is_open ? hours.closes_at : null,
      }))),
      'Operating hours saved.',
    )
  }

  async function submitWindow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const capacity = Number(windowDraft.maximum_capacity)
    if (!windowDraft.weekday || !windowDraft.starts_at || !windowDraft.ends_at || windowDraft.ends_at <= windowDraft.starts_at) {
      setError('Choose an operating day and valid start/end times for the delivery window.')
      return
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError('Window capacity must be a whole number greater than zero.')
      return
    }

    const template: Omit<WindowTemplate, 'id' | 'created_at' | 'updated_at'> & { id?: string } = {
      ...(editingTemplateId ? { id: editingTemplateId } : {}),
      weekday: Number(windowDraft.weekday) as Weekday,
      label: windowDraft.label.trim() || `${windowDraft.starts_at}–${windowDraft.ends_at}`,
      starts_at: windowDraft.starts_at,
      ends_at: windowDraft.ends_at,
      maximum_capacity: capacity,
      is_enabled: windowDraft.is_enabled,
    }

    await runAction(async () => {
      await saveWindowTemplate(template)
      setWindowDraft(initialWindowDraft)
      setEditingTemplateId(null)
    }, editingTemplateId ? 'Delivery window updated.' : 'Delivery window created.')
  }

  async function submitClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!closureDraft.closure_date || !closureDraft.reason.trim()) {
      setError('Choose a closure date and enter a reason.')
      return
    }
    if (!closureDraft.is_all_day && (
      !closureDraft.starts_at || !closureDraft.ends_at || closureDraft.ends_at <= closureDraft.starts_at
    )) {
      setError('Enter valid start and end times for a partial-day closure.')
      return
    }

    await runAction(async () => {
      await createCompanyClosure({
        closure_date: closureDraft.closure_date,
        is_all_day: closureDraft.is_all_day,
        starts_at: closureDraft.is_all_day ? null : closureDraft.starts_at,
        ends_at: closureDraft.is_all_day ? null : closureDraft.ends_at,
        reason: closureDraft.reason.trim(),
      })
      setClosureDraft((current) => ({ ...current, reason: '' }))
    }, 'Closure added.')
  }

  async function toggleTemplate(template: WindowTemplate) {
    await runAction(
      () => setWindowTemplateEnabled(template.id, !template.is_enabled),
      `Delivery window ${template.is_enabled ? 'disabled' : 'enabled'}.`,
    )
  }

  async function handleRelease(id: string) {
    if (!window.confirm('Release this reservation and return its capacity?')) return
    await runAction(() => releaseReservation(id), 'Reservation released.')
  }

  function editTemplate(template: WindowTemplate) {
    setEditingTemplateId(template.id)
    setWindowDraft({
      weekday: String(template.weekday),
      label: template.label,
      starts_at: formatTimeInput(template.starts_at),
      ends_at: formatTimeInput(template.ends_at),
      maximum_capacity: String(template.maximum_capacity),
      is_enabled: template.is_enabled,
    })
    setActiveTab('windows')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const rangeTitle = formatRangeLabel(anchorDate, view)
  const visibleTabs = tabLabels.map((tab) => (
    <button
      key={tab.id}
      type="button"
      aria-pressed={activeTab === tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-bold transition sm:px-4 sm:text-sm ${
        activeTab === tab.id
          ? 'border-[#c9a227] text-[#102342]'
          : 'border-transparent text-slate-500 hover:text-[#35558f]'
      }`}
    >
      {tab.label}
    </button>
  ))

  return (
    <main className="min-h-screen bg-[#f4f6f9]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#8c7117]">Operations</p>
            <h1 className="mt-1 font-[Georgia] text-2xl text-[#102342] sm:text-3xl">Scheduling</h1>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || saving}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:px-4 sm:text-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5m-4.1-3A8 8 0 0 1 18 6l2 2M4 16l2 2a8 8 0 0 0 13.1-3" />
            </svg>
            Refresh
          </button>
        </div>
        <nav aria-label="Scheduling sections" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {visibleTabs}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {!supabaseConfiguration.isComplete && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the local environment to connect scheduling.
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
            <span>{error}</span>
            <button type="button" className="shrink-0 font-bold underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {notice}
          </div>
        )}

        {loading ? (
          <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Loading scheduling data…
          </div>
        ) : (
          <>
            <section aria-label="Scheduling overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard label="Delivery windows" value={schedule?.windows.length ?? 0} detail="In the selected calendar range" />
              <SummaryCard label="Reservations" value={reservationsInView} detail={`${confirmedInView} confirmed`} />
              <SummaryCard label="Available capacity" value={remainingInView} detail="Spots remaining in view" />
              <SummaryCard label="Fully booked" value={fullWindows} detail="Windows at capacity" />
            </section>

            {activeTab === 'calendar' && (
              <div className="space-y-5">
                <SectionCard title="Delivery calendar" detail="Review scheduled capacity and select a date to inspect its windows.">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Previous period"
                        onClick={() => setAnchorDate((date) => shiftCalendarDate(date, view, -1))}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-700 hover:bg-slate-50"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date()
                          setAnchorDate(today)
                          setSelectedDate(getLocalToday())
                        }}
                        className="h-10 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        aria-label="Next period"
                        onClick={() => setAnchorDate((date) => shiftCalendarDate(date, view, 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-lg text-slate-700 hover:bg-slate-50"
                      >
                        ›
                      </button>
                      <h3 className="ml-1 text-sm font-extrabold text-[#102342] sm:ml-2 sm:text-base">{rangeTitle}</h3>
                    </div>
                    <div role="group" aria-label="Calendar view" className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
                      {(['day', 'week', 'month'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={view === option}
                          onClick={() => setView(option)}
                          className={`rounded px-2.5 py-1.5 text-xs font-bold capitalize sm:px-3 ${
                            view === option ? 'bg-[#102342] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  {view === 'month' ? (
                    <div className="overflow-x-auto">
                      <div className="min-w-[620px]">
                        <div className="grid grid-cols-7 border-b border-slate-200 pb-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
                          {weekdayNames.map((day) => <span key={day}>{day.slice(0, 3)}</span>)}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-1.5">
                          {calendarDates.map((date) => {
                            const key = formatDateKey(date)
                            const dayWindows = windowsByDate.get(key) ?? []
                            const booked = dayWindows.reduce((sum, item) => sum + item.reservation_count, 0)
                            const remaining = dayWindows
                              .filter((item) => item.is_enabled && !item.is_closed)
                              .reduce((sum, item) => sum + item.remaining_capacity, 0)
                            const inMonth = date.getMonth() === anchorDate.getMonth()
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setSelectedDate(key)
                                  setAnchorDate(date)
                                }}
                                className={`min-h-[76px] rounded-md border p-1.5 text-left transition sm:min-h-[92px] sm:p-2 ${
                                  selectedDate === key
                                    ? 'border-[#35558f] bg-[#edf2f9] ring-1 ring-[#35558f]/20'
                                    : 'border-slate-100 bg-white hover:border-slate-300'
                                } ${inMonth ? '' : 'opacity-45'}`}
                              >
                                <span className="text-xs font-bold text-slate-700">{date.getDate()}</span>
                                {dayWindows.length > 0 && (
                                  <span className="mt-1 block text-[9px] leading-4 text-slate-500 sm:text-[10px]">
                                    {dayWindows.length} windows<br />{booked} booked · {remaining} open
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : view === 'week' ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                      {calendarDates.map((date) => {
                        const key = formatDateKey(date)
                        const dayWindows = windowsByDate.get(key) ?? []
                        const available = dayWindows
                          .filter((item) => item.is_enabled && !item.is_closed)
                          .reduce((sum, item) => sum + item.remaining_capacity, 0)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(key)}
                            className={`min-h-24 rounded-lg border p-3 text-left transition ${
                              selectedDate === key
                                ? 'border-[#35558f] bg-[#edf2f9] ring-1 ring-[#35558f]/20'
                                : 'border-slate-200 bg-white hover:border-slate-400'
                            }`}
                          >
                            <span className="block text-[10px] font-bold uppercase text-slate-500">{weekdayNames[date.getDay()].slice(0, 3)}</span>
                            <span className="mt-1 block text-lg font-extrabold text-[#102342]">{date.getDate()}</span>
                            <span className="mt-1 block text-[10px] text-slate-500">{dayWindows.length} windows · {available} open</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
                      <label htmlFor="admin-calendar-date" className="text-xs font-bold text-slate-600">View date</label>
                      <input
                        id="admin-calendar-date"
                        type="date"
                        value={selectedDate}
                        onChange={(event) => {
                          setSelectedDate(event.target.value)
                          if (event.target.value) setAnchorDate(parseDateKey(event.target.value))
                        }}
                        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title={`Windows · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(parseDateKey(selectedDate))}`}
                  detail="Pending holds count against capacity until their configured expiration."
                >
                  {selectedWindows.length === 0 ? (
                    <EmptyState>No delivery windows are configured for this date. Add an operating day and a recurring window to make availability.</EmptyState>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {selectedWindows.map((window) => {
                        const status = getWindowAvailability(window)
                        const pending = Math.max(0, window.reservation_count - window.confirmed_count)
                        return (
                          <div key={window.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <div>
                              <p className="text-sm font-bold text-[#102342]">
                                {window.label} <span className="font-medium text-slate-500">
                                  {formatWindowTime(window.starts_at, schedule?.settings?.time_zone)} – {formatWindowTime(window.ends_at, schedule?.settings?.time_zone)}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {window.confirmed_count} confirmed · {pending} active holds · {window.remaining_capacity} of {window.maximum_capacity} spots open
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              status === 'available' ? 'bg-emerald-50 text-emerald-700' : status === 'full' ? 'bg-rose-50 text-rose-700' : status === 'closed' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {status === 'available' ? 'Available' : status === 'full' ? 'Full' : status === 'closed' ? 'Closed' : 'Disabled'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === 'hours' && (
              <SectionCard title="Operating hours" detail="Set the company’s local business hours by weekday. Closed days will not generate delivery windows.">
                <form onSubmit={(event) => void submitHours(event)} className="space-y-3">
                  {hoursDraft.map((hours) => (
                    <div key={hours.weekday} className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2 rounded-lg bg-slate-50 p-2.5 sm:gap-4 sm:p-3">
                      <span className="text-xs font-bold text-[#102342] sm:text-sm">{formatDayName(hours.weekday)}</span>
                      <input
                        type="checkbox"
                        aria-label={`${formatDayName(hours.weekday)} open`}
                        checked={hours.is_open}
                        onChange={(event) => setHoursDraft((current) => current.map((item) =>
                          item.weekday === hours.weekday
                            ? { ...item, is_open: event.target.checked, opens_at: event.target.checked ? item.opens_at : null, closes_at: event.target.checked ? item.closes_at : null }
                            : item,
                        ))}
                        className="h-4 w-4 accent-[#35558f]"
                      />
                      {hours.is_open ? (
                        <>
                          <input
                            type="time"
                            aria-label={`${formatDayName(hours.weekday)} opens`}
                            value={formatTimeInput(hours.opens_at)}
                            onChange={(event) => setHoursDraft((current) => current.map((item) => item.weekday === hours.weekday ? { ...item, opens_at: event.target.value } : item))}
                            className="min-h-10 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs sm:text-sm"
                          />
                          <input
                            type="time"
                            aria-label={`${formatDayName(hours.weekday)} closes`}
                            value={formatTimeInput(hours.closes_at)}
                            onChange={(event) => setHoursDraft((current) => current.map((item) => item.weekday === hours.weekday ? { ...item, closes_at: event.target.value } : item))}
                            className="min-h-10 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs sm:text-sm"
                          />
                        </>
                      ) : (
                        <span className="col-span-2 text-xs text-slate-400">Closed</span>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <button disabled={saving} className="min-h-11 rounded-md bg-[#102342] px-5 text-sm font-bold text-white hover:bg-[#1a355c] disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save operating hours'}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

            {activeTab === 'windows' && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
                <SectionCard title="Recurring delivery windows" detail="Windows repeat on the selected weekday and are materialized in the configured time zone. Overlapping windows on a day are rejected.">
                  {schedule?.templates.length ? (
                    <div className="divide-y divide-slate-100">
                      {schedule.templates.map((template) => (
                        <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              aria-label={`${template.label} enabled`}
                              checked={template.is_enabled}
                              onChange={() => void toggleTemplate(template)}
                              disabled={saving}
                              className="mt-1 h-4 w-4 accent-[#35558f]"
                            />
                            <div>
                              <p className="text-sm font-bold text-[#102342]">{template.label}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDayName(template.weekday)} · {formatTimeInput(template.starts_at)}–{formatTimeInput(template.ends_at)} · Capacity {template.maximum_capacity}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => editTemplate(template)}
                            className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>No recurring windows yet. Add one with the form to make dates bookable.</EmptyState>
                  )}
                </SectionCard>

                <SectionCard title={editingTemplateId ? 'Edit delivery window' : 'Create delivery window'}>
                  <form onSubmit={(event) => void submitWindow(event)} className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Operating day
                      <select
                        className={inputClass}
                        value={windowDraft.weekday}
                        onChange={(event) => setWindowDraft((current) => ({ ...current, weekday: event.target.value }))}
                        required
                      >
                        <option value="">Select a day</option>
                        {weekdayNames.map((day, weekday) => (
                          <option key={day} value={weekday}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700">
                      Window label
                      <input className={inputClass} value={windowDraft.label} onChange={(event) => setWindowDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Optional, e.g. Morning delivery" maxLength={80} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Start time
                        <input className={inputClass} type="time" value={windowDraft.starts_at} onChange={(event) => setWindowDraft((current) => ({ ...current, starts_at: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        End time
                        <input className={inputClass} type="time" value={windowDraft.ends_at} onChange={(event) => setWindowDraft((current) => ({ ...current, ends_at: event.target.value }))} required />
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Maximum bookings per window
                      <input className={inputClass} type="number" min="1" step="1" value={windowDraft.maximum_capacity} onChange={(event) => setWindowDraft((current) => ({ ...current, maximum_capacity: event.target.value }))} required />
                    </label>
                    <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={windowDraft.is_enabled} onChange={(event) => setWindowDraft((current) => ({ ...current, is_enabled: event.target.checked }))} className="h-4 w-4 accent-[#35558f]" />
                      Enable this window
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button disabled={saving} className="min-h-11 flex-1 rounded-md bg-[#102342] px-4 text-sm font-bold text-white hover:bg-[#1a355c] disabled:opacity-50">
                        {saving ? 'Saving…' : editingTemplateId ? 'Save changes' : 'Create window'}
                      </button>
                      {editingTemplateId && (
                        <button type="button" onClick={() => { setEditingTemplateId(null); setWindowDraft(initialWindowDraft) }} className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700">
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </SectionCard>
              </div>
            )}

            {activeTab === 'closures' && (
              <div className="grid gap-5 xl:grid-cols-2">
                <SectionCard title="Company closures" detail="All-day holidays and partial-day closures prevent overlapping delivery windows from being offered.">
                  {schedule?.closures.length ? (
                    <ul className="divide-y divide-slate-100">
                      {schedule.closures.map((closure) => (
                        <li key={closure.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                          <div>
                            <p className="text-sm font-bold text-[#102342]">
                              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parseDateKey(closure.closure_date))}
                              {!closure.is_all_day && ` · ${formatTimeInput(closure.starts_at)}–${formatTimeInput(closure.ends_at)}`}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{closure.reason}</p>
                          </div>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void runAction(() => removeCompanyClosure(closure.id), 'Closure removed.')}
                            className="min-h-9 rounded-md border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>No closures are recorded in the selected calendar range.</EmptyState>
                  )}
                </SectionCard>

                <SectionCard title="Add a closure">
                  <form onSubmit={(event) => void submitClosure(event)} className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Closure date
                      <input className={inputClass} type="date" value={closureDraft.closure_date} onChange={(event) => setClosureDraft((current) => ({ ...current, closure_date: event.target.value }))} required />
                    </label>
                    <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={closureDraft.is_all_day} onChange={(event) => setClosureDraft((current) => ({ ...current, is_all_day: event.target.checked }))} className="h-4 w-4 accent-[#35558f]" />
                      Close for the full day
                    </label>
                    {!closureDraft.is_all_day && (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs font-semibold text-slate-700">
                          Starts at
                          <input className={inputClass} type="time" value={closureDraft.starts_at} onChange={(event) => setClosureDraft((current) => ({ ...current, starts_at: event.target.value }))} required />
                        </label>
                        <label className="block text-xs font-semibold text-slate-700">
                          Ends at
                          <input className={inputClass} type="time" value={closureDraft.ends_at} onChange={(event) => setClosureDraft((current) => ({ ...current, ends_at: event.target.value }))} required />
                        </label>
                      </div>
                    )}
                    <label className="block text-xs font-semibold text-slate-700">
                      Reason
                      <input className={inputClass} value={closureDraft.reason} onChange={(event) => setClosureDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Holiday, maintenance, weather…" maxLength={160} required />
                    </label>
                    <button disabled={saving} className="min-h-11 w-full rounded-md bg-[#102342] px-4 text-sm font-bold text-white hover:bg-[#1a355c] disabled:opacity-50">
                      {saving ? 'Saving…' : 'Add closure'}
                    </button>
                  </form>
                </SectionCard>

                <div className="xl:col-span-2">
                  <SectionCard title="Booking restrictions" detail="These values are checked by the database when availability is requested and again when a reservation is made.">
                    <form onSubmit={(event) => void submitSettings(event)} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="block text-xs font-semibold text-slate-700">
                        Company time zone
                        <input className={inputClass} value={settingsDraft.time_zone} onChange={(event) => setSettingsDraft((current) => ({ ...current, time_zone: event.target.value }))} placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone || 'IANA time zone'} required />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Minimum notice (minutes)
                        <input className={inputClass} type="number" min="0" step="1" value={settingsDraft.minimum_advance_minutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, minimum_advance_minutes: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Schedule up to (days ahead)
                        <input className={inputClass} type="number" min="1" max="365" step="1" value={settingsDraft.maximum_advance_days} onChange={(event) => setSettingsDraft((current) => ({ ...current, maximum_advance_days: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Reservation hold (minutes)
                        <input className={inputClass} type="number" min="1" max="60" step="1" value={settingsDraft.reservation_hold_minutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, reservation_hold_minutes: event.target.value }))} required />
                      </label>
                      <div className="sm:col-span-2 xl:col-span-4">
                        <button disabled={saving} className="min-h-11 rounded-md bg-[#102342] px-5 text-sm font-bold text-white hover:bg-[#1a355c] disabled:opacity-50">
                          {saving ? 'Saving…' : 'Save booking restrictions'}
                        </button>
                      </div>
                    </form>
                  </SectionCard>
                </div>
              </div>
            )}

            {activeTab === 'reservations' && (
              <SectionCard title="Recent reservations" detail="Pending holds consume capacity until their expiry. Payment confirmation must come from the trusted payment backend.">
                {schedule?.reservations.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-3 pr-4">Reservation</th>
                          <th className="pb-3 pr-4">Window</th>
                          <th className="pb-3 pr-4">Status</th>
                          <th className="pb-3 pr-4">Hold expires</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {schedule.reservations.map((reservation) => {
                          const window = schedule.windows.find((item) => item.id === reservation.delivery_window_id)
                          const canRelease = reservation.status === 'pending' || reservation.status === 'confirmed'
                          return (
                            <tr key={reservation.id}>
                              <td className="py-3 pr-4 font-mono text-xs text-slate-600">{reservation.id.slice(0, 8)}…</td>
                              <td className="py-3 pr-4 text-xs text-slate-600">
                                {window ? `${window.service_date} · ${window.label}` : reservation.delivery_window_id.slice(0, 8)}
                              </td>
                              <td className="py-3 pr-4">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{reservation.status}</span>
                              </td>
                              <td className="py-3 pr-4 text-xs text-slate-600">
                                {new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short', timeZone: schedule.settings?.time_zone }).format(new Date(reservation.expires_at))}
                              </td>
                              <td className="py-3 text-right">
                                {canRelease ? (
                                  <button type="button" disabled={saving} onClick={() => void handleRelease(reservation.id)} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                    Release
                                  </button>
                                ) : <span className="text-xs text-slate-400">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState>No reservations have been recorded yet.</EmptyState>
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </main>
  )
}
