export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type CalendarView = 'day' | 'week' | 'month'
export type ReservationStatus = 'pending' | 'confirmed' | 'expired' | 'released' | 'cancelled'

export interface SchedulingSettings {
  id: true
  time_zone: string
  minimum_advance_minutes: number
  maximum_advance_days: number
  reservation_hold_minutes: number
  updated_at: string
}

export interface CustomerSchedulingRules {
  time_zone: string
  minimum_advance_minutes: number
  maximum_advance_days: number
}

export interface OperatingHours {
  weekday: Weekday
  is_open: boolean
  opens_at: string | null
  closes_at: string | null
  updated_at: string
}

export interface WindowTemplate {
  id: string
  weekday: Weekday
  label: string
  starts_at: string
  ends_at: string
  maximum_capacity: number
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CompanyClosure {
  id: string
  closure_date: string
  is_all_day: boolean
  starts_at: string | null
  ends_at: string | null
  reason: string
  created_at: string
  updated_at: string
}

export interface CalendarWindow {
  id: string
  template_id: string
  label: string
  service_date: string
  starts_at: string
  ends_at: string
  maximum_capacity: number
  is_enabled: boolean
  is_closed: boolean
  reservation_count: number
  confirmed_count: number
  remaining_capacity: number
}

export interface DeliveryWindowRecord {
  id: string
  template_id: string
  service_date: string
  starts_at: string
  ends_at: string
  maximum_capacity: number
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AvailableWindow {
  id: string
  service_date: string
  starts_at: string
  ends_at: string
  maximum_capacity: number
  reservation_count: number
  remaining_capacity: number
}

export interface CapacityReservation {
  id: string
  delivery_window_id: string
  customer_user_id: string | null
  status: ReservationStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export interface CapacityReservationRecord extends CapacityReservation {
  access_token_hash: string
}

export interface ReservationHandle {
  reservation_id: string
  reservation_token: string
  expires_at: string
}

export interface GuestReservation {
  reservation_id: string
  status: ReservationStatus
  expires_at: string
  service_date: string
  starts_at: string
  ends_at: string
}

export interface AdminScheduleData {
  settings: SchedulingSettings | null
  operatingHours: OperatingHours[]
  templates: WindowTemplate[]
  closures: CompanyClosure[]
  windows: CalendarWindow[]
  reservations: CapacityReservation[]
}

export interface CalendarRange {
  start: Date
  end: Date
}
