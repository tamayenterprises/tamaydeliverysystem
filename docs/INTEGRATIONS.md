# Integrations

## Supabase

Supabase provides authentication, PostgreSQL, Storage, Realtime, Edge Functions, and RLS. Configure it through deployment environment variables only.

## Stripe

Use Stripe PaymentIntents or Checkout for customer payments. Verify webhook signatures on the backend and never collect card details in application database tables.

## Google APIs

Google Places supports address entry. Google Routes calculates actual road distance and estimated duration on the backend.

## Email

Use a transactional email provider for payment, delivery, assignment, and status notifications.

## Scheduling

Scheduling availability and reservation operations are PostgreSQL RPCs in the versioned scheduling migration. Payment confirmation must call the trusted reservation-confirmation RPC after webhook verification; Delivery Management owns delivery association and cancellation/reschedule decisions. See [Scheduling System](../src/modules/scheduling/README.md).

No credentials are stored in source control. Use placeholder values in `.env.example`.
