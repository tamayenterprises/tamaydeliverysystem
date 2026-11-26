# Database Architecture

Use one shared PostgreSQL database with UUID primary keys, foreign keys, constraints, indexes, and timestamps.

## Initial Tables

- Identity: `profiles`, `customers`, `drivers`, `admin_roles`
- Fleet: `trucks`, `driver_shifts`, `driver_vehicle_assignments`
- Delivery: `deliveries`, `packages`, `driver_assignments`, `delivery_events`, `proof_of_delivery`
- Scheduling: `delivery_windows`, `capacity_reservations`
- Pricing: `pricing_rules`, `pricing_quotes`
- Finance: `payments`, `refunds`, `receipts`
- Operations: `notification_logs`
- Scheduling: `scheduling_settings`, `company_operating_hours`, `delivery_window_templates`, `company_closures`, `delivery_windows`, `capacity_reservations`

Scheduling tables and reservation rules are defined in `supabase/migrations/20261125210000_scheduling_system.sql`. Recurring templates materialize dated windows in the configured time zone; capacity is guarded by a row lock and pending holds expire after an administrator-configured duration.

Do not add a table until its module responsibility and relationships are documented. Every migration belongs to the feature branch that introduces it.
