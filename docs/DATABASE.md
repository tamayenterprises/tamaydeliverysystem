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

Do not add a table until its module responsibility and relationships are documented. Every migration belongs to the feature branch that introduces it.
