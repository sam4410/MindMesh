Add the backend for AI architecture reviews: an API route, a token route, and a Trigger.dev task that scores the design against the Well-Architected pillars and lists findings.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- skip the usage check in `POST /api/ai/review`, the new `TaskRunKind` value, and the `reviewRunsPerMonth` plan limit (they depend on specs 34 and 36)
- create the `TaskRun` record the same way the spec routes do today
- ignore the "Usage limits apply to reviews" check

## Implementation

1. Define the result schema in `types/tasks.ts`.
   - `REVIEW_PILLARS = ["reliability", "security", "cost", "performance", "operations"] as const`
   - `reviewResultSchema`:
     - `summary: string`
     - `pillars: { pillar: enum(REVIEW_PILLARS); score: number (1–5); notes: string }[]` (exactly one entry per pillar)
     - `findings: { severity: "high" | "medium" | "low"; pillar; title: string; detail: string; recommendation: string; nodeIds: string[] }[]` (max 20)
   - follow the OpenAI strict-schema rules used in `lib/design-actions.ts`: no optional fields, no min/max length rules on strings

2. Create the task: `trigger/review-architecture.ts`.
   - `schemaTask` with id `review-architecture`, payload `{ projectId, nodes, edges, designContext }` reusing the spec node and edge schemas
   - `generateText` with `Output.object({ schema: reviewResultSchema })`, using the same OpenAI model as the design agent
   - the prompt asks for a review against the AWS/Azure Well-Architected pillars for the project's cloud (generic best practice when agnostic), plus industry controls when an industry is set
   - drop any `nodeIds` that don't exist on the canvas before returning
   - set run metadata `status` to `processing`, then `completed` or `failed`, like `generate-spec`
   - return the review as the task output; no retries that would double-charge usage

3. Add the routes.
   - `POST /api/ai/review`: mirror `POST /api/ai/spec` (auth, Zod validation, `getAccessibleProject` from `roomId`, design context from the project, usage check, trigger, `TaskRun` record, 202 `{ runId }`)
   - `POST /api/ai/review/token`: mirror the spec token route (ownership check, run-scoped public token, 1 hour)

4. Meter it.
   - add `REVIEW` to the `TaskRunKind` enum (migration `add_review_task_kind`)
   - add `reviewRunsPerMonth` to `PLANS` (Free 3, Team 100)

## Scope Limits

- don't build UI (next spec)
- don't persist reviews; the result lives in the run output
- don't change the design or spec tasks

## Check When Done

- `POST /api/ai/review` returns a run ID and records a `REVIEW` task run.
- The task returns five pillar scores and findings whose node IDs all exist.
- The token route only serves the run owner.
- Usage limits apply to reviews.
- `npm run build` passes and `trigger dev` registers the task.
