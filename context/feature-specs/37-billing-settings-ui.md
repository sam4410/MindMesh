Add a billing page and clear limit-reached messages, so users can see their plan and usage and upgrade.

## Implementation

1. Create the billing page.
   - `app/settings/billing/page.tsx` as a server component
   - show:
     - workspace name (organization name or "Personal")
     - plan, subscription status, and renewal date (`currentPeriodEnd`)
     - usage this month for each task kind: used / limit with a progress bar
   - read data with `getBillingAccount`, `getActivePlan`, and `getMonthlyUsage`
   - show `?checkout=success` as a confirmation banner, noting it can take a few seconds for the plan to update

2. Add billing actions.
   - "Upgrade to Team" calls `POST /api/billing/checkout` and redirects to the returned URL
   - "Manage billing" calls `POST /api/billing/portal` and redirects
   - show both only to organization admins or in the personal workspace; members see "Ask an admin to change the plan"

3. Link to the page.
   - add a "Billing" item to the Clerk `UserButton` menu using `UserButton.Link` with `href="/settings/billing"`
   - add the same link on the editor home screen

4. Show limit-reached messages.
   - update `lib/post-json.ts` so a failed request throws an error that carries `status` and the parsed JSON body (keep the message format for other callers)
   - in `components/editor/ai-sidebar.tsx` and `components/editor/specs-tab.tsx`, handle status 402 `limit_reached`:
     - show "You've used all {limit} AI {designs|specs} this month on the {plan} plan." with an "Upgrade" link to `/settings/billing`
     - keep the existing generic messages for other errors

## Scope Limits

- don't change limits or the webhook
- don't add invoices or payment history (the Stripe portal covers them)
- don't modify `components/ui/*`

## Notes

- Follow `context/ui-context.md` for tokens and spacing.
- Use existing `Button` and `Card` components.

## Check When Done

- `/settings/billing` shows the plan, renewal date, and usage bars.
- An admin can open checkout and the customer portal; a member sees the "Ask an admin" note.
- Hitting the limit in the AI sidebar or Specs tab shows the upgrade message.
- `npm run build` passes.
