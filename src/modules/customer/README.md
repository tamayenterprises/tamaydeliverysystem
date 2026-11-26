# Customer Application Module

## Purpose

Provides the customer-facing delivery request experience.

## Current Scope

- Customer home page
- Delivery request route
- Pickup and destination contact details
- Requested pickup date and live delivery-window selection within the delivery request form
- Package category, dimensions, weight, and special handling
- Browser-local request draft persistence, plus a temporary server-side hold for the selected window
- Mobile-first responsive layouts with touch-friendly controls and accessible form labels
- Tamay Enterprises brand styling across navigation, landing page, and request form

## Dependencies

- Authentication is not yet integrated.
- Routing will validate addresses and calculate road distance.
- Pricing will calculate the quote from trusted backend data.
- Scheduling availability and reservation are integrated into the delivery request form.
- Payments and receipts will complete checkout.

## Validation

Run `npm run build` and `npm run lint`. This feature branch should not be merged until routing and form integration tests are added.
