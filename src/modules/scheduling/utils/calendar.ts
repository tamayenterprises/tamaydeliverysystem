import type { CalendarRange, CalendarView, Weekday } from '../types/scheduling'

export const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function getCalendarRange(anchorDate: Date, view: CalendarView): CalendarRange {
  if (view === 'day') {
    return { start: new Date(anchorDate), end: new Date(anchorDate) }
  }

  if (view === 'week') {
    const start = addDays(anchorDate, -anchorDate.getDay())
    return { start, end: addDays(start, 6) }
  }

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  const start = addDays(monthStart, -monthStart.getDay())
  const end = addDays(monthEnd, 6 - monthEnd.getDay())
  return { start, end }
}

export function getCalendarDates(anchorDate: Date, view: CalendarView): Date[] {
  const { start, end } = getCalendarRange(anchorDate, view)
  const dates: Date[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date)
  }
  return dates
}

export function shiftCalendarDate(date: Date, view: CalendarView, direction: -1 | 1): Date {
  if (view === 'day') return addDays(date, direction)
  if (view === 'week') return addDays(date, direction * 7)
  return new Date(date.getFullYear(), date.getMonth() + direction, 1)
}

export function weekdayFromDate(date: Date): Weekday {
  return date.getDay() as Weekday
}

export function formatRangeLabel(anchorDate: Date, view: CalendarView): string {
  const { start, end } = getCalendarRange(anchorDate, view)
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  if (view === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(anchorDate)
  }

  if (formatDateKey(start) === formatDateKey(end)) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(start)
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`
}

export function formatWindowTime(isoDateTime: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(isoDateTime))
}

export function formatDayName(weekday: Weekday): string {
  return weekdayNames[weekday]
}

export function formatTimeInput(value: string | null): string {
  return value?.slice(0, 5) ?? ''
}
