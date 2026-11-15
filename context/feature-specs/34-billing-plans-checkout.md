Add subscription plans and Stripe checkout. This unit stores subscription records and creates checkout and customer-portal sessions. Webhooks, limits, and UI come in later specs.

## Implementation

1. Define plans in `lib/plans.ts`.
   - `PLAN_IDS = ["FREE", "TEAM", "ENTERPRISE"] as const`
   - `PLANS` record with per-plan monthly limits, starting with:
     - `FREE`: `designRunsPerMonth: 5`, `specRunsPerMonth: 5`
     - `TEAM`: `designRunsPerMonth: 300`, `specRunsPerMonth: 300`, priced per seat through `STRIPE_PRICE_TEAM`
     - `ENTERPRISE`: not self-serve; limits set manually
   - later specs add limits for new task kinds here

2. Add the `Subscription` model.
   - `prisma/models/subscription.prisma`:
     - `id String @id @default(cuid())`
     - `billingAccountId String @unique` (Clerk organization ID, or Clerk user ID for a personal workspace)
     - `accountType BillingAccountType` enum `USER | ORGANIZATION`
     - `stripeCustomerId String @unique`
     - `stripeSubscriptionId String? @unique`
     - `stripeCheckoutSessionId String? @unique` (the workspace's pending Checkout Session, if any)
     - `plan Plan` enum `FREE | TEAM | ENTERPRISE`, default `FREE`
     - `status String` (Stripe subscription status, e.g. `active`, `past_due`, `canceled`)
     - `seats Int @default(1)`
     - `currentPeriodEnd DateTime?`
     - `createdAt`, `updatedAt`
   - create migration `add_subscription`

3. Add server helpers.
   - install `stripe`; create `lib/stripe.ts` exporting a server-only client from `STRIPE_SECRET_KEY`
   - `lib/billing.ts`:
     - `getBillingAccount(identity)` returns `{ id: identity.orgId ?? identity.userId, type }`
     - `getActivePlan(billingAccountId)` returns the plan, treating no record or a non-`active`/`trialing` status as `FREE`

4. Add `POST /api/billing/checkout`.
   - authenticate; only an organization admin, or the user in a personal workspace, may buy (403 otherwise)
   - find or create the Stripe customer, with `metadata.billingAccountId`, and upsert the `Subscription` row; set `plan: FREE` only when creating a new row, and leave the plan and subscription status unchanged when updating an existing row
   - before creating a session, look up the `Subscription` by `billingAccountId`; return 409 if it has a `stripeSubscriptionId` whose status is not `canceled` or `incomplete_expired`
   - serialize the pending-session check and creation per `billingAccountId`; retrieve any stored `stripeCheckoutSessionId` with Stripe. If its status is `open`, return its URL instead of creating another session; if `expired`, clear the stored ID and create a new session; if `complete`, return 409 until the subscription state is synchronized. Store the new session ID on the `Subscription` row. On session-creation failure, release the per-account lock and leave the plan and subscription status unchanged.
   - create a Checkout Session: `mode: "subscription"`, price `STRIPE_PRICE_TEAM`, quantity = organization member count from `clerkClient().organizations.getOrganization` (`membersCount`) or 1
   - keep Team seat quantity in sync with organization membership: handle Clerk organization membership created/deleted events by enqueueing a durable Trigger.dev task; the task must reread `membersCount` using `clerkClient().organizations.getOrganization`, then update the Team subscription item's Stripe quantity to `max(1, membersCount ?? 1)`. Retry failed count lookups or Stripe quantity updates up to 5 attempts with exponential backoff; surface exhausted failures through Trigger.dev's failure alerts so they can be investigated and retried.
   - `success_url`: `${NEXT_PUBLIC_APP_URL}/settings/billing?checkout=success`; `cancel_url` remains `${NEXT_PUBLIC_APP_URL}/settings/billing`
   - return `{ url }`

5. Add `POST /api/billing/portal`.
   - same permission rule; 404 when there is no Stripe customer
   - create a Billing Portal session and return `{ url }`

## Scope Limits

- don't handle Stripe webhooks (next spec); the plan is not upgraded yet after checkout
- don't enforce limits or build UI
- don't add Enterprise checkout

## Notes

- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_TEAM`, `NEXT_PUBLIC_APP_URL`. Add them to Vercel and document them, without values.
- Use Stripe test mode while developing.

## Check When Done

- `Subscription` model and migration exist.
- `POST /api/billing/checkout` returns a Stripe Checkout URL for an admin and 403 for a member.
- `POST /api/billing/portal` returns a portal URL once a customer exists.
- `npm run build` passes.
