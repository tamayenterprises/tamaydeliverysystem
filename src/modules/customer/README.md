# Customer Application Module

## Purpose

Provides the customer-facing delivery request experience.

## Current Scope

- Customer home page
- Delivery request route
- Pickup and destination contact details
- Package category, dimensions, weight, and special handling
- Browser-local draft persistence and validation

## Dependencies

- Authentication is not yet integrated.
- Routing will validate addresses and calculate road distance.
- Pricing will calculate the quote from trusted backend data.
- Scheduling will reserve a delivery window.
- Payments and receipts will complete checkout.

## Validation

Run `npm run build` and `npm run lint`. This feature branch should not be merged until routing and form integration tests are added.
