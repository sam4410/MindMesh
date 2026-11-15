Show cost estimates in the AI sidebar, with per-component ranges, a total, and CSV export.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- skip the 402 upgrade message from spec 37; show the generic error message instead

## Implementation

1. Add a Cost tab.
   - in `components/editor/ai-sidebar.tsx` add a "Cost" tab after Review; keep it mounted
   - create `components/editor/cost-tab.tsx` with props `{ projectId, isActive, getCanvas, designContext }`
   - with four tabs, use short labels and icons so they fit the sidebar width

2. Collect assumptions.
   - traffic tier select (Small / Medium / Large, with the request and data numbers from spec 64 as help text)
   - region text input with a provider-specific default (`us-east-1`, `eastus`, `us-central1`)
   - when the project has no AWS, Azure, or GCP provider, show "Set a cloud provider in Design context to estimate costs" instead of the form

3. Run the estimate.
   - "Estimate cost" posts to `/api/ai/cost`, gets the token, and follows the run with `useRealtimeRun` (`skipColumns: ["payload"]`)
   - spinner while running; 402 shows the upgrade message from spec 37

4. Show the result.
   - a table: component (node label), service, tier, monthly range ("$120 – $340")
   - total range at the bottom, in bold
   - a list of unpriced components and the caveats
   - a fixed note: "Rough list-price estimate, not a quote."
   - clicking a row calls `focusNodes([nodeId])` from spec 53
   - "Download CSV" exports the table plus a total row as `${toSlug(projectName)}-cost-estimate.csv` (quote fields that contain commas)

## Scope Limits

- don't persist or compare estimates
- don't change the cost task
- don't add currency conversion

## Check When Done

- The Cost tab estimates an AWS, Azure, or GCP project and shows line items and totals.
- Projects without a provider see the guidance message.
- Rows focus their node; CSV downloads correctly.
- `npm run build` passes.
