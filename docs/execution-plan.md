# Execution Plan

This document converts the product vision into an implementation order that can be executed with minimal rework.

## Delivery principle

Build the system in layers:

1. platform foundation
2. durable data model
3. provider ingestion
4. automation and alerting
5. workflow and marketplace depth
6. mobile client

Do not start by integrating every external API. The system should work for manual-only vehicles first, then become better as integrations are added.

## Phase 1: Foundation

### Outcomes

- production-ready database schema
- authenticated users and garages
- manual vehicle creation flow
- API contracts backed by persisted data instead of mocks

### Build tasks

- Add Postgres and a migration tool
- Create tables for users, garages, memberships, vehicles, telemetry snapshots, valuations, maintenance plans, maintenance tasks, alerts, part searches, part listings, service requests, and provider connections
- Add auth and protected routes
- Replace in-memory demo data with seeded database records
- Add environment validation and secrets handling

### Exit criteria

- a signed-in user can create a garage
- a vehicle survives restart and redeploy
- `/api/dashboard` and `/api/vehicles` read from the database

## Phase 2: Vehicle and valuation integrations

### Outcomes

- VIN decode at vehicle onboarding
- connected-car account linking
- telemetry ingest pipeline
- valuation history refresh

### Build tasks

- Integrate NHTSA vPIC for VIN decode and normalization
- Integrate Smartcar OAuth and callback flow
- Add webhook endpoint and signature verification
- Store provider access tokens and refresh metadata securely
- Integrate MarketCheck valuation fetches on a schedule
- Persist raw provider payloads for debugging and replay

### Exit criteria

- user can add a vehicle by VIN and get decoded specs
- supported vehicles can connect to Smartcar
- telemetry snapshots appear without manual refresh
- valuation history is appended over time

## Phase 3: Maintenance engine and alerts

### Outcomes

- rules-based maintenance schedule
- due-soon and overdue alerts
- email, SMS, and push notification channels

### Build tasks

- model OEM and heuristic maintenance rules
- derive due dates from mileage, time, powertrain, and service history
- create alert generation jobs
- add channel preferences and quiet hours
- implement email and SMS notification adapters

### Exit criteria

- every vehicle has a maintenance timeline
- alerts are created automatically from state changes
- notifications can be tested end to end

## Phase 4: Service workflow

### Outcomes

- service brief generation
- appointment request workflow
- partner-specific scheduling extension point

### Build tasks

- create service request model and UI
- generate shop-ready service summaries
- support calendar export, email handoff, and click-to-call
- add adapters for shops or dealer groups with usable APIs

### Exit criteria

- a due task can become a service request
- the request can be handed off with all relevant vehicle and issue context

## Phase 5: Parts and accessory intelligence

### Outcomes

- search across marketplaces
- fitment-aware result ranking
- price tracking and saved searches

### Build tasks

- integrate Amazon and eBay search APIs
- normalize listing shape and seller metadata
- score fitment against year, make, model, trim, and engine
- add search history and watchlists
- add price-drop alerts

### Exit criteria

- user can search per vehicle and compare marketplace results
- saved searches can notify on price or availability changes

## Phase 6: Mobile app

### Outcomes

- mobile garage dashboard
- push notifications
- VIN scan and quick add flow
- on-the-go service and parts workflows

### Build tasks

- build Expo app against existing API surface
- share types between web and mobile
- add auth session handling
- add push token registration
- add camera-based VIN capture and barcode scan

### Exit criteria

- mobile user can view vehicles, receive alerts, and act on maintenance

## Cross-cutting requirements

### Security

- encrypt sensitive provider credentials at rest
- audit-log provider connection changes
- scope users by garage membership
- implement rate limiting for public endpoints and callbacks

### Reliability

- retries and dead-letter strategy for jobs
- idempotency on webhook ingest
- provider health tracking
- structured error logging and alerts

### Product analytics

- garage creation funnel
- vehicle connection success rate
- notification engagement
- marketplace conversion metrics
