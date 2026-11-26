import type {
  AvailableWindow,
  CalendarWindow,
  CapacityReservationRecord,
  CompanyClosure,
  CustomerSchedulingRules,
  DeliveryWindowRecord,
  GuestReservation,
  OperatingHours,
  ReservationHandle,
  SchedulingSettings,
  WindowTemplate,
} from '../../modules/scheduling/types/scheduling'

type TableShape<Row, Insert, Update = Partial<Insert>> = {
  Row: Row & Record<string, unknown>
  Insert: Insert & Record<string, unknown>
  Update: Update & Record<string, unknown>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      scheduling_settings: TableShape<
        SchedulingSettings,
        Omit<SchedulingSettings, 'updated_at'> & { updated_at?: string }
      >
      company_operating_hours: TableShape<
        OperatingHours,
        Omit<OperatingHours, 'updated_at'> & { updated_at?: string }
      >
      delivery_window_templates: TableShape<
        WindowTemplate,
        Omit<WindowTemplate, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
      >
      company_closures: TableShape<
        CompanyClosure,
        Omit<CompanyClosure, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
      >
      delivery_windows: TableShape<
        DeliveryWindowRecord,
        Omit<DeliveryWindowRecord, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
      >
      capacity_reservations: TableShape<
        CapacityReservationRecord,
        Omit<CapacityReservationRecord, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      is_scheduling_admin: { Args: Record<string, never>; Returns: boolean }
      get_scheduling_calendar: {
        Args: { p_start_date: string; p_end_date: string }
        Returns: CalendarWindow[]
      }
      get_available_delivery_windows: {
        Args: { p_start_date: string; p_end_date: string }
        Returns: AvailableWindow[]
      }
      get_customer_scheduling_rules: {
        Args: Record<string, never>
        Returns: CustomerSchedulingRules[]
      }
      reserve_delivery_window: {
        Args: { p_window_id: string }
        Returns: ReservationHandle[]
      }
      get_guest_reservation: {
        Args: { p_reservation_token: string }
        Returns: GuestReservation[]
      }
      confirm_delivery_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      release_delivery_reservation: {
        Args: { p_reservation_id: string; p_cancelled?: boolean }
        Returns: undefined
      }
      expire_pending_delivery_reservations: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
