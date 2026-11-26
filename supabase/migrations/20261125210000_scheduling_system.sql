create table public.scheduling_settings (
  id boolean primary key default true check (id),
  time_zone text not null,
  minimum_advance_minutes integer not null check (minimum_advance_minutes between 0 and 525600),
  maximum_advance_days integer not null check (maximum_advance_days between 1 and 365),
  reservation_hold_minutes integer not null check (reservation_hold_minutes between 1 and 60),
  updated_at timestamptz not null default now()
);

create table public.company_operating_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  updated_at timestamptz not null default now(),
  check (
    (is_open and opens_at is not null and closes_at is not null and closes_at > opens_at)
    or (not is_open and opens_at is null and closes_at is null)
  )
);

create table public.delivery_window_templates (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null references public.company_operating_hours (weekday),
  label text not null check (length(trim(label)) between 1 and 80),
  starts_at time not null,
  ends_at time not null,
  maximum_capacity integer not null check (maximum_capacity > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (weekday, starts_at, ends_at)
);

create table public.company_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null,
  is_all_day boolean not null default true,
  starts_at time,
  ends_at time,
  reason text not null check (length(trim(reason)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_all_day and starts_at is null and ends_at is null)
    or (not is_all_day and starts_at is not null and ends_at is not null and ends_at > starts_at)
  )
);

create table public.delivery_windows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.delivery_window_templates (id) on delete restrict,
  service_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  maximum_capacity integer not null check (maximum_capacity > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (template_id, service_date)
);

create table public.capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  delivery_window_id uuid not null references public.delivery_windows (id) on delete restrict,
  customer_user_id uuid references auth.users (id) on delete set null,
  access_token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired', 'released', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(access_token_hash) = 32)
);

create index delivery_window_date_idx
  on public.delivery_windows (service_date, starts_at)
  where is_enabled;

create index capacity_reservations_window_status_expiry_idx
  on public.capacity_reservations (delivery_window_id, status, expires_at);

create index capacity_reservations_customer_idx
  on public.capacity_reservations (customer_user_id, created_at desc)
  where customer_user_id is not null;

create index capacity_reservations_expiring_idx
  on public.capacity_reservations (expires_at)
  where status = 'pending';

create index company_closures_date_idx
  on public.company_closures (closure_date);

create or replace function public.set_scheduling_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger scheduling_settings_updated_at
before update on public.scheduling_settings
for each row execute function public.set_scheduling_updated_at();

create trigger operating_hours_updated_at
before update on public.company_operating_hours
for each row execute function public.set_scheduling_updated_at();

create trigger window_templates_updated_at
before update on public.delivery_window_templates
for each row execute function public.set_scheduling_updated_at();

create trigger company_closures_updated_at
before update on public.company_closures
for each row execute function public.set_scheduling_updated_at();

create trigger delivery_windows_updated_at
before update on public.delivery_windows
for each row execute function public.set_scheduling_updated_at();

create trigger capacity_reservations_updated_at
before update on public.capacity_reservations
for each row execute function public.set_scheduling_updated_at();

create or replace function public.validate_scheduling_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_timezone_names
    where name = new.time_zone
  ) then
    raise exception 'The configured scheduling time zone is invalid'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger scheduling_settings_valid_time_zone
before insert or update of time_zone
on public.scheduling_settings
for each row execute function public.validate_scheduling_time_zone();

create or replace function public.is_scheduling_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('administrator', 'super_administrator'),
    false
  );
$$;

create or replace function public.prevent_overlapping_window_templates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(88301, new.weekday::integer);

  if not exists (
    select 1
    from public.company_operating_hours hours
    where hours.weekday = new.weekday
      and hours.is_open
      and new.starts_at >= hours.opens_at
      and new.ends_at <= hours.closes_at
  ) then
    raise exception 'Delivery windows must fit within an open day’s operating hours'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.delivery_window_templates existing
    where existing.weekday = new.weekday
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and existing.starts_at < new.ends_at
      and new.starts_at < existing.ends_at
  ) then
    raise exception 'Delivery windows cannot overlap on the same operating day'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger delivery_window_templates_no_overlap
before insert or update of weekday, starts_at, ends_at
on public.delivery_window_templates
for each row execute function public.prevent_overlapping_window_templates();

create or replace function public.prevent_operating_hours_excluding_windows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_open and exists (
    select 1
    from public.delivery_window_templates t
    where t.weekday = new.weekday
      and (t.starts_at < new.opens_at or t.ends_at > new.closes_at)
  ) then
    raise exception 'Operating hours cannot exclude an existing recurring delivery window'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger company_operating_hours_keep_templates_valid
before insert or update of weekday, is_open, opens_at, closes_at
on public.company_operating_hours
for each row execute function public.prevent_operating_hours_excluding_windows();

alter table public.scheduling_settings enable row level security;
alter table public.company_operating_hours enable row level security;
alter table public.delivery_window_templates enable row level security;
alter table public.company_closures enable row level security;
alter table public.delivery_windows enable row level security;
alter table public.capacity_reservations enable row level security;

create policy "Scheduling admins manage settings"
on public.scheduling_settings
for all to authenticated
using (public.is_scheduling_admin())
with check (public.is_scheduling_admin());

create policy "Scheduling admins manage operating hours"
on public.company_operating_hours
for all to authenticated
using (public.is_scheduling_admin())
with check (public.is_scheduling_admin());

create policy "Scheduling admins manage window templates"
on public.delivery_window_templates
for all to authenticated
using (public.is_scheduling_admin())
with check (public.is_scheduling_admin());

create policy "Scheduling admins manage closures"
on public.company_closures
for all to authenticated
using (public.is_scheduling_admin())
with check (public.is_scheduling_admin());

create policy "Scheduling admins view delivery windows"
on public.delivery_windows
for select to authenticated
using (public.is_scheduling_admin());

create policy "Customers and admins view permitted reservations"
on public.capacity_reservations
for select to authenticated
using (
  customer_user_id = (select auth.uid())
  or public.is_scheduling_admin()
);

grant select, insert, update, delete
on public.scheduling_settings,
   public.company_operating_hours,
   public.delivery_window_templates,
   public.company_closures
to authenticated;

grant select on public.delivery_windows, public.capacity_reservations to authenticated;
grant all on public.scheduling_settings,
  public.company_operating_hours,
  public.delivery_window_templates,
  public.company_closures,
  public.delivery_windows,
  public.capacity_reservations
to service_role;

create or replace function public._materialize_delivery_windows(
  p_start_date date,
  p_end_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.scheduling_settings%rowtype;
  v_date date;
  v_hours public.company_operating_hours%rowtype;
  v_template public.delivery_window_templates%rowtype;
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_start_date is null or p_end_date is null
    or p_end_date < p_start_date or p_end_date - p_start_date > 90 then
    raise exception 'The requested scheduling range must be between 1 and 91 days'
      using errcode = '22023';
  end if;

  select * into v_settings
  from public.scheduling_settings
  where id = true;

  if not found then
    raise exception 'Scheduling has not been configured by an administrator'
      using errcode = '55000';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_settings.time_zone) then
    raise exception 'The configured scheduling time zone is invalid'
      using errcode = '22023';
  end if;

  update public.capacity_reservations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  for v_date in
    select generate_series(p_start_date, p_end_date, interval '1 day')::date
  loop
    select * into v_hours
    from public.company_operating_hours
    where weekday = extract(dow from v_date)::smallint;

    if not found or not v_hours.is_open then
      continue;
    end if;

    for v_template in
      select *
      from public.delivery_window_templates
      where weekday = extract(dow from v_date)::smallint
        and starts_at >= v_hours.opens_at
        and ends_at <= v_hours.closes_at
    loop
      if exists (
        select 1
        from public.company_closures c
        where c.closure_date = v_date
          and (
            c.is_all_day
            or (v_template.starts_at < c.ends_at and c.starts_at < v_template.ends_at)
          )
      ) then
        continue;
      end if;

      v_start := (v_date + v_template.starts_at) at time zone v_settings.time_zone;
      v_end := (v_date + v_template.ends_at) at time zone v_settings.time_zone;

      insert into public.delivery_windows (
        template_id,
        service_date,
        starts_at,
        ends_at,
        maximum_capacity,
        is_enabled
      )
      values (
        v_template.id,
        v_date,
        v_start,
        v_end,
        v_template.maximum_capacity,
        v_template.is_enabled
      )
      on conflict (template_id, service_date)
      do update set
        starts_at = case
          when not exists (
            select 1
            from public.capacity_reservations r
            where r.delivery_window_id = delivery_windows.id
              and (
                r.status = 'confirmed'
                or (r.status = 'pending' and r.expires_at > now())
              )
          ) then excluded.starts_at
          else delivery_windows.starts_at
        end,
        ends_at = case
          when not exists (
            select 1
            from public.capacity_reservations r
            where r.delivery_window_id = delivery_windows.id
              and (
                r.status = 'confirmed'
                or (r.status = 'pending' and r.expires_at > now())
              )
          ) then excluded.ends_at
          else delivery_windows.ends_at
        end,
        maximum_capacity = excluded.maximum_capacity,
        is_enabled = excluded.is_enabled,
        updated_at = now();
    end loop;
  end loop;
end;
$$;

create or replace function public.get_customer_scheduling_rules()
returns table (
  time_zone text,
  minimum_advance_minutes integer,
  maximum_advance_days integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    settings.time_zone,
    settings.minimum_advance_minutes,
    settings.maximum_advance_days
  from public.scheduling_settings settings
  where settings.id = true;
$$;

create or replace function public.get_available_delivery_windows(
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  service_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  maximum_capacity integer,
  reservation_count bigint,
  remaining_capacity bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.scheduling_settings%rowtype;
  v_today date;
begin
  select * into v_settings
  from public.scheduling_settings
  where scheduling_settings.id = true;

  if not found then
    raise exception 'Scheduling has not been configured by an administrator'
      using errcode = '55000';
  end if;

  v_today := (now() at time zone v_settings.time_zone)::date;

  if p_start_date is null or p_end_date is null
    or p_start_date < v_today
    or p_end_date < p_start_date
    or p_start_date > v_today + v_settings.maximum_advance_days
    or p_end_date > v_today + v_settings.maximum_advance_days
    or p_end_date - p_start_date > 90 then
    raise exception 'The requested dates are outside the allowed booking range'
      using errcode = '22023';
  end if;

  perform public._materialize_delivery_windows(p_start_date, p_end_date);

  return query
  select
    w.id,
    w.service_date,
    w.starts_at,
    w.ends_at,
    w.maximum_capacity,
    counts.reservation_count,
    greatest(w.maximum_capacity - counts.reservation_count, 0)::bigint
  from public.delivery_windows w
  cross join lateral (
    select count(*)::bigint as reservation_count
    from public.capacity_reservations r
    where r.delivery_window_id = w.id
      and (
        r.status = 'confirmed'
        or (r.status = 'pending' and r.expires_at > now())
      )
  ) counts
  where w.service_date between p_start_date and p_end_date
    and w.is_enabled
    and w.starts_at >= now() + make_interval(mins => v_settings.minimum_advance_minutes)
    and counts.reservation_count < w.maximum_capacity
    and not exists (
      select 1
      from public.company_closures c
      where c.closure_date = w.service_date
        and (
          c.is_all_day
          or (
            (w.starts_at at time zone v_settings.time_zone)::time < c.ends_at
            and c.starts_at < (w.ends_at at time zone v_settings.time_zone)::time
          )
        )
    )
  order by w.service_date, w.starts_at;
end;
$$;

create or replace function public.get_scheduling_calendar(
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  template_id uuid,
  label text,
  service_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  maximum_capacity integer,
  is_enabled boolean,
  is_closed boolean,
  reservation_count bigint,
  confirmed_count bigint,
  remaining_capacity bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.scheduling_settings%rowtype;
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'Calendar dates are required'
      using errcode = '22023';
  end if;

  if not public.is_scheduling_admin() then
    raise exception 'Administrator access is required'
      using errcode = '42501';
  end if;

  perform public._materialize_delivery_windows(p_start_date, p_end_date);
  select * into v_settings
  from public.scheduling_settings
  where scheduling_settings.id = true;

  return query
  select
    w.id,
    w.template_id,
    t.label,
    w.service_date,
    w.starts_at,
    w.ends_at,
    w.maximum_capacity,
    w.is_enabled,
    exists (
      select 1
      from public.company_closures c
      where c.closure_date = w.service_date
        and (
          c.is_all_day
          or (
            (w.starts_at at time zone v_settings.time_zone)::time < c.ends_at
            and c.starts_at < (w.ends_at at time zone v_settings.time_zone)::time
          )
        )
    ) as is_closed,
    counts.reservation_count,
    counts.confirmed_count,
    greatest(w.maximum_capacity - counts.reservation_count, 0)::bigint
  from public.delivery_windows w
  join public.delivery_window_templates t on t.id = w.template_id
  cross join lateral (
    select
      count(*) filter (
        where r.status = 'confirmed'
          or (r.status = 'pending' and r.expires_at > now())
      )::bigint as reservation_count,
      count(*) filter (where r.status = 'confirmed')::bigint as confirmed_count
    from public.capacity_reservations r
    where r.delivery_window_id = w.id
  ) counts
  where w.service_date between p_start_date and p_end_date
  order by w.service_date, w.starts_at;
end;
$$;

create or replace function public.reserve_delivery_window(p_window_id uuid)
returns table (
  reservation_id uuid,
  reservation_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.scheduling_settings%rowtype;
  v_window public.delivery_windows%rowtype;
  v_reservation_id uuid;
  v_token text;
  v_count bigint;
  v_today date;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    raise exception 'Customer access is required to reserve a delivery window'
      using errcode = '42501';
  end if;

  select * into v_settings
  from public.scheduling_settings
  where id = true;

  if not found then
    raise exception 'Scheduling has not been configured by an administrator'
      using errcode = '55000';
  end if;

  v_today := (now() at time zone v_settings.time_zone)::date;
  perform public._materialize_delivery_windows(v_today, v_today + v_settings.maximum_advance_days);

  select * into v_window
  from public.delivery_windows
  where id = p_window_id
    and is_enabled
  for update;

  if not found then
    raise exception 'This delivery window is unavailable'
      using errcode = 'P0001';
  end if;

  if v_window.service_date < v_today
    or v_window.service_date > v_today + v_settings.maximum_advance_days
    or v_window.starts_at < now() + make_interval(mins => v_settings.minimum_advance_minutes)
    or exists (
      select 1
      from public.company_closures c
      where c.closure_date = v_window.service_date
        and (
          c.is_all_day
          or (
            (v_window.starts_at at time zone v_settings.time_zone)::time < c.ends_at
            and c.starts_at < (v_window.ends_at at time zone v_settings.time_zone)::time
          )
        )
    ) then
    raise exception 'This delivery window is outside the available schedule'
      using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.capacity_reservations r
  where r.delivery_window_id = v_window.id
    and (
      r.status = 'confirmed'
      or (r.status = 'pending' and r.expires_at > now())
    );

  if v_count >= v_window.maximum_capacity then
    raise exception 'This delivery window is fully booked'
      using errcode = 'P0001';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_reservation_id := gen_random_uuid();

  insert into public.capacity_reservations (
    id,
    delivery_window_id,
    customer_user_id,
    access_token_hash,
    status,
    expires_at
  )
  values (
    v_reservation_id,
    v_window.id,
    auth.uid(),
    md5(v_token),
    'pending',
    now() + make_interval(mins => v_settings.reservation_hold_minutes)
  );

  return query
  select r.id, v_token, r.expires_at
  from public.capacity_reservations r
  where r.id = v_reservation_id;
end;
$$;

create or replace function public.get_guest_reservation(p_reservation_token text)
returns table (
  reservation_id uuid,
  status text,
  expires_at timestamptz,
  service_date date,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    case
      when r.status = 'pending' and r.expires_at <= now() then 'expired'
      else r.status
    end,
    r.expires_at,
    w.service_date,
    w.starts_at,
    w.ends_at
  from public.capacity_reservations r
  join public.delivery_windows w on w.id = r.delivery_window_id
  where r.access_token_hash =
    md5(p_reservation_token);
$$;

create or replace function public.confirm_delivery_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.capacity_reservations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only a trusted payment service can confirm a reservation'
      using errcode = '42501';
  end if;

  select * into v_reservation
  from public.capacity_reservations
  where id = p_reservation_id
  for update;

  if not found
    or v_reservation.status <> 'pending'
    or v_reservation.expires_at <= now() then
    raise exception 'The pending reservation is missing or expired'
      using errcode = 'P0001';
  end if;

  update public.capacity_reservations
  set status = 'confirmed'
  where id = p_reservation_id;
end;
$$;

create or replace function public.release_delivery_reservation(
  p_reservation_id uuid,
  p_cancelled boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.capacity_reservations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_scheduling_admin() then
    raise exception 'Authorized scheduling access is required'
      using errcode = '42501';
  end if;

  select * into v_reservation
  from public.capacity_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found'
      using errcode = 'P0002';
  end if;

  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'Only pending or confirmed reservations can be released'
      using errcode = 'P0001';
  end if;

  update public.capacity_reservations
  set status = case when p_cancelled then 'cancelled' else 'released' end
  where id = p_reservation_id;
end;
$$;

create or replace function public.expire_pending_delivery_reservations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only a trusted backend can expire reservations'
      using errcode = '42501';
  end if;

  update public.capacity_reservations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  get diagnostics v_expired_count = row_count;
  return v_expired_count;
end;
$$;

revoke all on function public._materialize_delivery_windows(date, date) from public, anon, authenticated;
revoke all on function public.is_scheduling_admin() from public, anon;
revoke all on function public.get_scheduling_calendar(date, date) from public, anon, authenticated;
revoke all on function public.get_available_delivery_windows(date, date) from public;
revoke all on function public.get_customer_scheduling_rules() from public;
revoke all on function public.reserve_delivery_window(uuid) from public;
revoke all on function public.get_guest_reservation(text) from public;
revoke all on function public.confirm_delivery_reservation(uuid) from public, anon, authenticated;
revoke all on function public.release_delivery_reservation(uuid, boolean) from public, anon, authenticated;
revoke all on function public.expire_pending_delivery_reservations() from public, anon, authenticated;

grant execute on function public.is_scheduling_admin() to authenticated;
grant execute on function public.get_scheduling_calendar(date, date) to authenticated;
grant execute on function public.get_available_delivery_windows(date, date) to anon, authenticated;
grant execute on function public.get_customer_scheduling_rules() to anon, authenticated;
grant execute on function public.reserve_delivery_window(uuid) to anon, authenticated;
grant execute on function public.get_guest_reservation(text) to anon, authenticated;
grant execute on function public.confirm_delivery_reservation(uuid) to service_role;
grant execute on function public.release_delivery_reservation(uuid, boolean) to service_role, authenticated;
grant execute on function public.expire_pending_delivery_reservations() to service_role;
