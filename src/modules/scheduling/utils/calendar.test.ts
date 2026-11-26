import { describe, expect, it } from 'vitest'
import { formatDateKey, getCalendarDates, getCalendarRange, shiftCalendarDate } from './calendar'
import { getWindowAvailability, isReservationOccupyingCapacity } from './capacity'
import type { CalendarWindow } from '../types/scheduling'

describe('scheduling calendar utilities', () => {
  it('returns a Sunday-through-Saturday week range', () => {
    const anchor = new Date(2026, 10, 25)
    const range = getCalendarRange(anchor, 'week')

    expect(formatDateKey(range.start)).toBe('2026-11-22')
    expect(formatDateKey(range.end)).toBe('2026-11-28')
  })

  it('includes complete calendar weeks for the monthly view', () => {
    const dates = getCalendarDates(new Date(2026, 1, 1), 'month')

    expect(dates).toHaveLength(28)
    expect(formatDateKey(dates[0])).toBe('2026-02-01')
    expect(formatDateKey(dates[dates.length - 1])).toBe('2026-02-28')
  })

  it('moves a month view across year boundaries', () => {
    expect(formatDateKey(shiftCalendarDate(new Date(2026, 11, 1), 'month', 1))).toBe('2027-01-01')
  })
})

describe('scheduling capacity display', () => {
  const now = new Date('2026-11-25T18:00:00Z')

  it('does not count expired pending holds, but counts confirmed reservations', () => {
    expect(isReservationOccupyingCapacity('pending', '2026-11-25T17:59:00Z', now)).toBe(false)
    expect(isReservationOccupyingCapacity('pending', '2026-11-25T18:01:00Z', now)).toBe(true)
    expect(isReservationOccupyingCapacity('confirmed', '2026-11-25T17:00:00Z', now)).toBe(true)
  })

  it('distinguishes available, full, and disabled delivery windows', () => {
    const base: CalendarWindow = {
      id: 'window-1',
      template_id: 'template-1',
      label: 'Morning',
      service_date: '2026-11-26',
      starts_at: '2026-11-26T13:00:00Z',
      ends_at: '2026-11-26T15:00:00Z',
      maximum_capacity: 5,
      is_enabled: true,
      is_closed: false,
      reservation_count: 2,
      confirmed_count: 1,
      remaining_capacity: 3,
    }

    expect(getWindowAvailability(base)).toBe('available')
    expect(getWindowAvailability({ ...base, remaining_capacity: 0 })).toBe('full')
    expect(getWindowAvailability({ ...base, is_enabled: false })).toBe('disabled')
    expect(getWindowAvailability({ ...base, is_closed: true })).toBe('closed')
  })
})
