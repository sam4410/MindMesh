Count AI runs per workspace and block new runs once the monthly plan limit is reached. This unit is server-side only.

## Implementation

1. Record what each run is and who pays for it.
   - in `prisma/models/task-run.prisma` add:
     - `kind TaskRunKind @default(DESIGN)` with enum `TaskRunKind { DESIGN SPEC }` (later specs add more values)
     - `billingAccountId String?`
     - `@@index([billingAccountId, kind, createdAt])`
   - create migration `add_task_run_usage`
   - existing rows become `DESIGN` with no billing account; they don't count toward limits

2. Charge the project's workspace, not the user's.
   - add `getProjectBillingAccountId(project)` to `lib/billing.ts`: the project's `organizationId`, or its `ownerId` for a personal project
   - a collaborator running AI on someone else's project uses that project's allowance

3. Add `lib/usage.ts`.
   - `getMonthlyUsage(billingAccountId, kind)` counts `TaskRun` rows for the current calendar month in UTC
   - `checkUsage(billingAccountId, kind)` returns `{ allowed, used, limit, plan }` using `getActivePlan` and `PLANS`

4. Enforce limits in the AI routes.
   - `POST /api/ai/design` and `POST /api/ai/spec`: after the access check and before triggering the task, call `checkUsage`
   - when not allowed, return 402 `{ error: "limit_reached", kind, used, limit, plan }`
   - when creating the `TaskRun`, set `kind` (`DESIGN` or `SPEC`) and `billingAccountId`

## Scope Limits

- don't build UI or change client error handling (next spec)
- don't add per-seat limits; limits are per workspace
- don't add other task kinds yet

## Notes

- `shortcut:` two runs started at the same moment can both pass the check and exceed the limit by one. Acceptable at these volumes; switch to a counter row with a transaction if limits ever need to be exact.

## Check When Done

- New `TaskRun` rows record `kind` and `billingAccountId`.
- A Free workspace gets 402 on its 6th design run in a month.
- A Team workspace is allowed past the Free limit.
- Usage resets at the start of the next UTC month.
- `npm run build` passes.
