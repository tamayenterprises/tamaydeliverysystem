# Branching and Integration

## Permanent Branches

- `main` contains stable, production-ready code.
- `develop` integrates completed and tested feature work.

## Feature Branches

- `feature/authentication`
- `feature/customer-application`
- `feature/driver-application`
- `feature/admin-dashboard`
- `feature/pricing-engine`
- `feature/delivery-management`
- `feature/fleet-management`
- `feature/scheduling-system`
- `feature/payment-system`
- `feature/receipt-system`
- `feature/notifications`
- `feature/routing-system`

Create additional branches only for sufficiently independent work.

Before integration:

1. Rebase or merge the latest `develop` branch.
2. Run focused tests, linting, and the production build.
3. Review database migrations and security policies.
4. Merge only through a pull request or equivalent review checklist.
