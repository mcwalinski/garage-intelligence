# Garage Intelligence

Garage Intelligence is a starter platform for tracking a personal vehicle fleet across web and future mobile clients.

## Product focus

- Garage-wide vehicle inventory with VIN-aware records
- Connected-car telemetry and movement insights
- Market value tracking with historical trends
- Maintenance planning, alerts, and service workflow hooks
- Vehicle lifecycle tracking across owned, previously owned, and watched vehicles
- Parts and accessory discovery across marketplaces

## Verified provider direction

- `NHTSA vPIC`: free VIN/spec decoding baseline
- `Smartcar`: connected vehicle access and webhooks
- `MarketCheck`: market listings and valuation signals
- `Amazon Creators API`: product search direction after PA-API retirement

See [docs/architecture.md](/Users/firebornecapital/Documents/Playground/docs/architecture.md) for the system design and provider notes.
See [docs/execution-plan.md](/Users/firebornecapital/Documents/Playground/docs/execution-plan.md) for the implementation sequence.
See [docs/user-inputs.md](/Users/firebornecapital/Documents/Playground/docs/user-inputs.md) for the exact information required to complete live integrations.
See [docs/setup-supabase.md](/Users/firebornecapital/Documents/Playground/docs/setup-supabase.md) for the chosen zero-cost deployment stack.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current state

This repo includes:

- a Next.js web starter
- a typed domain model
- mock provider adapters that mirror real integration boundaries
- dashboard and vehicle detail views
- JSON API routes for dashboard and vehicle data

The current code uses mocked data so the UI and backend contract can be exercised before adding live credentials and background jobs.

## Next implementation targets

- add Postgres persistence
- add authentication and garage ownership
- replace mock API responses with database-backed services
- integrate live VIN decode first, then Smartcar and MarketCheck

## Selected launch stack

- Hosting: `Vercel Hobby`
- Database: `Supabase Free`
- Auth: `Supabase Auth` with `Google`
