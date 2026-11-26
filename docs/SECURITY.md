# Security

- Public registration creates customer accounts only.
- Administrators provision privileged accounts.
- Supabase RLS enforces customer, driver, administrator, and super-administrator access.
- Edge Functions perform privileged operations and verify external webhooks.
- Stripe and Supabase service-role secrets remain server-side.
- Guest access uses secure, unguessable tokens rather than public database identifiers.
- Money is stored in integer cents or fixed-precision values.
- Card numbers and security codes are never stored in the application database.
