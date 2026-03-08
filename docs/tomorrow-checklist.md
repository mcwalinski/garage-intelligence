# Tomorrow Checklist

These are the integrations and setup items that still need your side of the account/config work.

## High Priority

- `eBay API credentials`
  - Create or confirm `EBAY_CLIENT_ID`
  - Create or confirm `EBAY_CLIENT_SECRET`
  - This upgrades eBay from search-link fallback to live item-level marketplace results

- `Resend`
  - Create `RESEND_API_KEY`
  - This enables real email delivery from the notification center instead of skipped delivery logs

## Medium Priority

- `Twilio`
  - Create `TWILIO_ACCOUNT_SID`
  - Create `TWILIO_AUTH_TOKEN`
  - Create `TWILIO_FROM_NUMBER`
  - This enables SMS maintenance and movement alerts

- `Amazon product-side access`
  - Confirm what Amazon access path you want to use for richer item-level retrieval
  - Current implementation uses direct search links because that is the most reliable path without additional Amazon setup
  - If you want deeper Amazon catalog integration, we should decide between the current Creators direction or another affiliate/search path

## Already Working

- `Supabase`
  - Auth and database are already wired

- `Google sign-in`
  - Working locally

- `Smartcar`
  - OAuth and first telemetry sync path are working, with some OEM account variability

- `MarketCheck`
  - Working through VIN history pricing path

## Product Follow-Ups

- Decide whether `Owned` vehicles should eventually support archived service history entry
- Decide whether `Watching` vehicles should support saved price targets and market alerts
- Decide whether the homepage should default to the `Own` section only with tabs for `Owned` and `Watching`
