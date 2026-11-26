# Security

- Public registration creates customer accounts only.
- Administrators provision privileged accounts.
- Supabase RLS enforces customer, driver, administrator, and super-administrator access.
- Scheduling administration uses trusted Supabase `app_metadata.role` claims; UI state does not grant authorization.
- Guest reservation tokens are high-entropy bearer credentials; store only their digest in PostgreSQL and never log tokens.
- Only the trusted service-role payment workflow can confirm temporary scheduling reservations.
- Edge Functions perform privileged operations and verify external webhooks.
- Stripe and Supabase service-role secrets remain server-side.
- Guest access uses secure, unguessable tokens rather than public database identifiers.
- Money is stored in integer cents or fixed-precision values.
- Card numbers and security codes are never stored in the application database.
