import { requireSupabase } from '../../../services/supabase/client'
import type {
  AdminScheduleData,
  AvailableWindow,
  CalendarWindow,
  CompanyClosure,
  CustomerSchedulingRules,
  OperatingHours,
  ReservationHandle,
  SchedulingSettings,
  WindowTemplate,
} from '../types/scheduling'

export async function loadAdminSchedule(
  startDate: string,
  endDate: string,
): Promise<AdminScheduleData> {
  const client = requireSupabase()
  const { data: isAdmin, error: roleError } = await client.rpc('is_scheduling_admin')
  if (roleError) throw roleError
  if (!isAdmin) throw new Error('You must be signed in with an administrator account to manage scheduling.')

  const [settingsResult, hoursResult, templatesResult, closuresResult, reservationsResult] =
    await Promise.all([
      client.from('scheduling_settings').select('*').eq('id', true).maybeSingle(),
      client.from('company_operating_hours').select('*').order('weekday'),
      client.from('delivery_window_templates').select('*').order('weekday').order('starts_at'),
      client
        .from('company_closures')
        .select('*')
        .gte('closure_date', startDate)
        .lte('closure_date', endDate)
        .order('closure_date'),
      client
        .from('capacity_reservations')
        .select('id, delivery_window_id, customer_user_id, status, expires_at, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  const queryError = [
    settingsResult.error,
    hoursResult.error,
    templatesResult.error,
    closuresResult.error,
    reservationsResult.error,
  ].find((error) => error !== null)
  if (queryError) throw queryError

  let windows: CalendarWindow[] = []
  if (settingsResult.data) {
    const { data, error } = await client.rpc('get_scheduling_calendar', {
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (error) throw error
    windows = data ?? []
  }

  return {
    settings: settingsResult.data,
    operatingHours: hoursResult.data ?? [],
    templates: templatesResult.data ?? [],
    closures: closuresResult.data ?? [],
    windows,
    reservations: reservationsResult.data ?? [],
  }
}

export async function saveSchedulingSettings(
  settings: Omit<SchedulingSettings, 'updated_at'>,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('scheduling_settings')
    .upsert(settings, { onConflict: 'id' })
  if (error) throw error
}

export async function saveOperatingHours(
  hours: Array<Omit<OperatingHours, 'updated_at'>>,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('company_operating_hours')
    .upsert(hours, { onConflict: 'weekday' })
  if (error) throw error
}

export async function saveWindowTemplate(
  template: Omit<WindowTemplate, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<void> {
  const { error } = await requireSupabase()
    .from('delivery_window_templates')
    .upsert(template, { onConflict: 'id' })
  if (error) throw error
}

export async function setWindowTemplateEnabled(id: string, isEnabled: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from('delivery_window_templates')
    .update({ is_enabled: isEnabled })
    .eq('id', id)
  if (error) throw error
}

export async function createCompanyClosure(
  closure: Omit<CompanyClosure, 'id' | 'created_at' | 'updated_at'>,
): Promise<void> {
  const { error } = await requireSupabase().from('company_closures').insert(closure)
  if (error) throw error
}

export async function removeCompanyClosure(id: string): Promise<void> {
  const { error } = await requireSupabase().from('company_closures').delete().eq('id', id)
  if (error) throw error
}

export async function releaseReservation(id: string, cancelled = false): Promise<void> {
  const { error } = await requireSupabase().rpc('release_delivery_reservation', {
    p_reservation_id: id,
    p_cancelled: cancelled,
  })
  if (error) throw error
}

export async function getAvailableWindows(
  startDate: string,
  endDate: string,
): Promise<AvailableWindow[]> {
  const { data, error } = await requireSupabase().rpc('get_available_delivery_windows', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw error
  return data ?? []
}

export async function getCustomerSchedulingRules(): Promise<CustomerSchedulingRules> {
  const { data, error } = await requireSupabase().rpc('get_customer_scheduling_rules')
  if (error) throw error
  const rules = data?.[0]
  if (!rules) throw new Error('Scheduling has not been configured by the company yet.')
  return rules
}

export async function reserveWindow(windowId: string): Promise<ReservationHandle> {
  const { data, error } = await requireSupabase().rpc('reserve_delivery_window', {
    p_window_id: windowId,
  })
  if (error) throw error
  const reservation = data?.[0]
  if (!reservation) throw new Error('The scheduling service did not return a reservation.')
  return reservation
}
