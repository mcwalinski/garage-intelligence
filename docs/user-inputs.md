# User Inputs Required

This project can keep moving locally, but the following information or approvals are required from you to make the product fully functional.

## 1. Infrastructure choices

Needed from you:

- preferred hosting target: Vercel, AWS, or another platform
- preferred database host: Neon, Supabase, RDS, or self-hosted Postgres
- whether you want object storage for documents and photos in phase 1

Why it matters:

- auth callbacks, secrets handling, job scheduling, and deployment shape depend on these choices

## 2. Authentication decisions

Needed from you:

- preferred sign-in method for launch: Google, email magic link, or both
- whether this is single-user at first or multi-user garage sharing from day one

Why it matters:

- auth provider selection affects schema, onboarding, and invitation flows

## 3. Vehicle integration credentials

Needed from you:

- Smartcar developer account and app credentials
- confirmation of which OEMs and vehicle types you care about most

Why it matters:

- not every vehicle is supported equally; prioritization prevents wasted integration work

## 4. Market valuation access

Needed from you:

- MarketCheck account and API key, or approval to choose an alternative provider if coverage or pricing is weak
- target refresh cadence for valuations: daily, weekly, or on-demand

Why it matters:

- valuation providers are paid and rate-limited, so fetch cadence changes cost

## 5. Marketplace search scope

Needed from you:

- Amazon Associates / Creators API access
- eBay developer account approval
- decision on whether specialist marketplaces should be in phase 1 or phase 2

Why it matters:

- marketplace access and compliance rules vary; fitment quality improves with more sources

## 6. Notification channels

Needed from you:

- launch channels: email only, email plus SMS, or email plus SMS plus push
- provider preference if you already use one
- sender identity details for email and SMS

Why it matters:

- domain setup, phone provisioning, and mobile token handling depend on this

## 7. Service workflow scope

Needed from you:

- whether "create appointment" means direct API scheduling or a service request handoff is acceptable for launch
- any preferred dealer groups, independent shops, or networks to prioritize

Why it matters:

- there is no universal appointment API, so the launch workflow needs an explicit target

## 8. Product policy and ownership rules

Needed from you:

- whether you want document vault features for registration, insurance, warranties, and receipts
- whether family members or assistants need shared access and permissions
- whether location history should be stored long term or only recent movement status

Why it matters:

- these are privacy and retention decisions, not just implementation details

## 9. Design and brand

Needed from you:

- product name if different from Garage Intelligence
- logo, color direction, and tone preference
- whether the first release should feel consumer-luxury, enthusiast, or utility-focused

Why it matters:

- visual system and onboarding copy should match the intended audience

## 10. Immediate approvals

Needed from you:

- approval to add a database layer and auth next
- approval to add paid-provider hooks even if some credentials are still placeholders

Why it matters:

- these are the next code changes with the highest leverage

## Recommended reply format

Reply with short answers to these items:

- hosting
- database
- auth
- Smartcar
- valuation provider
- marketplaces
- notifications
- service workflow
- sharing/privacy
- brand direction
