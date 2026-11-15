Add the backend for rough monthly cost estimates: API route, token route, and a Trigger.dev task that prices each component of the design.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- skip the usage check in `POST /api/ai/cost`, the `COST` `TaskRunKind` value, and the `costRunsPerMonth` plan limit (they depend on specs 34 and 36)
- create the `TaskRun` record the same way the spec routes do today
- ignore the "Usage limits apply" check

## Implementation

1. Define the schemas in `types/tasks.ts`.
   - `costAssumptionsSchema`: `{ trafficTier: "small" | "medium" | "large", region: string (max 40) }`
     - small: about 10k requests/day and under 50 GB data; medium: about 1M requests/day and under 1 TB; large: about 50M requests/day and under 20 TB (put these numbers in the prompt)
   - `costEstimateSchema` (OpenAI strict rules: no optional fields):
     - `currency: "USD"`
     - `lineItems: { nodeId: string; service: string; tier: string; monthlyLow: number; monthlyHigh: number; assumption: string }[]`
     - `unpricedNodeIds: string[]` (components that aren't billable cloud services, e.g. clients)
     - `totalLow: number`, `totalHigh: number`
     - `caveats: string[]`

2. Create the task: `trigger/estimate-cost.ts`.
   - `schemaTask` id `estimate-cost`, payload `{ projectId, nodes, edges, designContext, assumptions }`
   - requires a cloud provider of `aws`, `azure`, or `gcp`; otherwise `AbortTaskRunError("Choose a cloud provider to estimate costs")`
   - OpenAI with `Output.object({ schema: costEstimateSchema })`, using the node `service` IDs where present
   - prompt: on-demand list prices for the region, no discounts or reserved pricing, a low–high range per component, explicit sizing assumptions
   - after the model answers, drop line items for unknown node IDs and recompute `totalLow` / `totalHigh` from the line items (don't trust the model's sums)
   - run metadata status like the other tasks; return the estimate as output

3. Add the routes and metering.
   - `POST /api/ai/cost` with `{ roomId, nodes, edges, assumptions }` and `POST /api/ai/cost/token`, mirroring the review routes
   - return 400 before triggering when the project has no AWS, Azure, or GCP provider
   - add `COST` to `TaskRunKind` (migration `add_cost_task_kind`) and `costRunsPerMonth` to `PLANS` (Free 3, Team 100)

## Scope Limits

- don't call cloud pricing APIs; `shortcut:` estimates are model-based list-price ranges; switch to the Azure Retail Prices API and AWS Price List API if customers need exact numbers
- don't persist estimates
- don't build UI (next spec)

## Check When Done

- A cost run for an Azure project returns line items, unpriced nodes, totals equal to the sum of line items, and caveats.
- Projects without a cloud provider get 400.
- Usage limits apply.
- `npm run build` passes and `trigger dev` registers the task.
