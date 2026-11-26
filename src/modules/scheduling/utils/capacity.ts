import type { CalendarWindow, ReservationStatus } from '../types/scheduling'

export function isReservationOccupyingCapacity(
  status: ReservationStatus,
  expiresAt: string,
  now: Date,
): boolean {
  return status === 'confirmed' || (status === 'pending' && new Date(expiresAt) > now)
}

export function getWindowAvailability(window: CalendarWindow): 'available' | 'full' | 'disabled' | 'closed' {
  if (window.is_closed) return 'closed'
  if (!window.is_enabled) return 'disabled'
  if (window.remaining_capacity <= 0) return 'full'
  return 'available'
}
