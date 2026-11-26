# Scheduling System

## Scope

Provides administrator schedule configuration, customer availability, recurring delivery windows, date closures, capacity reporting, and temporary reservations. It does not process payments or assign drivers and vehicles.

## Database

Apply `supabase/migrations/20261125210000_scheduling_system.sql` to a Supabase PostgreSQL project. The migration creates:

- `scheduling_settings` for the company time zone and booking limits.
- `company_operating_hours` for weekly operating hours.
- `delivery_window_templates` for recurring weekday windows and capacity.
- `company_closures` for all-day or partial-day exceptions.
- `delivery_windows` for dated occurrences generated from recurring templates.
- `capacity_reservations` for pending holds and confirmed bookings.

The migration does not seed business hours, capacities, or booking rules. An administrator must configure them before the customer availability API returns dates.

## Backend Contracts

- `get_customer_scheduling_rules()` and `get_available_delivery_windows(start, end)` expose safe customer scheduling data.
- `reserve_delivery_window(window_id)` validates restrictions, locks the occurrence row, checks capacity, and returns a temporary reservation plus a one-time guest access token.
- `get_scheduling_calendar(start, end)` returns calendar capacity and closure state for authorized administrators.
- `confirm_delivery_reservation(id)` is callable only by the trusted service-role payment workflow after verified payment.
- `release_delivery_reservation(id, cancelled)` releases a hold or cancels an authorized confirmed reservation.
- `expire_pending_delivery_reservations()` expires stale holds; availability and calendar materialization also sweep expired holds.

Only a digest of a high-entropy guest reservation token is stored for lookup; the token itself is returned once and kept in browser session storage. Do not log or expose it.

## Authorization

The migration expects authorized Supabase users to have a trusted `app_metadata.role` value of `administrator` or `super_administrator`. Customer role provisioning and sign-in belong to the Authentication feature. No client-side role flag is trusted for access control.

## Integration Dependencies

- Authentication must provision administrator app-metadata claims.
- Payment System must call reservation confirmation only after verifying a payment event, and release holds on failed/expired checkout.
- Delivery Management must associate confirmed reservations with delivery records and request release/cancellation on reschedule or cancellation.
- Driver and Fleet modules can later contribute resource-aware capacity; no duplicate driver or truck data is created here.
- Customer checkout is not yet available; this module currently creates temporary holds and clearly indicates that payment integration is pending.

## Validation

Run `npm run build`, `npm run lint`, and `npm run test`. Unit tests cover calendar date arithmetic and capacity display rules. The Supabase migration, RLS behavior, booking races, and payment callbacks still require a configured local or test Supabase project for integration testing.
