# Architecture

The platform is one modular application with a shared Supabase PostgreSQL backend.

## Frontend

- React and TypeScript
- Vite
- Tailwind CSS
- React Router
- Three interface route groups: customer, driver, and administrator

## Backend

- Supabase Authentication
- PostgreSQL and Row Level Security
- Supabase Storage for proof and receipt assets
- Supabase Realtime for operational updates
- Supabase Edge Functions for trusted calculations and privileged integrations

## Module Boundaries

Modules must define their responsibility, public contracts, database ownership, validation, tests, and documentation. Shared functionality belongs in `src/shared` or `src/services`; modules must not duplicate authentication or database access.
