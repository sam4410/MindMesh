Keep `Subscription` records in sync with Stripe through a signed webhook, so a completed checkout actually upgrades the workspace.

## Implementation

1. Add `POST /api/billing/webhook`.
   - read the raw body with `await req.text()` (don't parse JSON first; the signature covers the raw body)
   - verify with `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`
   - return 400 on a missing or invalid signature

2. Make the route reachable by Stripe.
   - in `proxy.ts`, let `/api/billing/webhook` through without a Clerk session (it is authenticated by the Stripe signature instead)
   - keep every other `/api` path behind the existing 401 check

3. Handle these events.
   - `checkout.session.completed`: retrieve the subscription and sync it
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`: sync the subscription
   - sync means: find the `Subscription` row by `stripeCustomerId` and update `stripeSubscriptionId`, `status`, `seats` (item quantity), `currentPeriodEnd`, and `plan`
   - map the price ID to a plan: `STRIPE_PRICE_TEAM` → `TEAM`; a deleted or `canceled` subscription → `FREE`
   - if no row matches, create it using `billingAccountId` from the customer's metadata
   - ignore other event types and return 200

4. Make processing safe to repeat.
   - every handler is an upsert to the latest Stripe state, so a re-delivered event changes nothing
   - return 500 when the database write fails, so Stripe retries

## Scope Limits

- don't add usage limits or UI
- don't store a log of every event
- don't handle invoices, refunds, or tax

## Notes

- New env var: `STRIPE_WEBHOOK_SECRET`.
- Test locally with `stripe listen --forward-to localhost:3000/api/billing/webhook` and `stripe trigger checkout.session.completed`.
- In production, create the endpoint in the Stripe dashboard for `https://<domain>/api/billing/webhook` with the four events above.

## Check When Done

- An invalid signature returns 400.
- A completed test checkout sets the workspace's `Subscription` to `TEAM` with status `active`.
- Cancelling in the customer portal moves it back to `FREE` once Stripe sends the update.
- Replaying the same event leaves the row unchanged.
- `npm run build` passes.
