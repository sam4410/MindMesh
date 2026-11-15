Let users generate and browse decision records (ADRs) from the Specs tab.

## Implementation

1. Share the run-following logic.
   - extract the start → token → `useRealtimeRun` → reload flow from `components/editor/specs-tab.tsx` into a hook `hooks/use-document-run.ts`
   - the hook takes the trigger route and token route (`/api/ai/spec` + token, or `/api/ai/adr` + token) and exposes `start(body)`, `isRunning`, and `notice`
   - keep the existing behavior: `skipColumns: ["payload", "output"]`, handle each finished run once, reload the list on success, and the 402 limit message

2. Add the ADR button.
   - next to "Generate Spec", add "Generate decision records" with the `outline` button variant
   - it sends the same body as Generate Spec (chat history and canvas) to `/api/ai/adr`
   - while either run is active, both buttons are disabled and the active one shows a spinner

3. Show the kind in the list.
   - each row shows a small badge: "Spec" or "ADR"
   - add filter chips above the list: All, Specs, Decision records
   - the empty state text matches the filter, e.g. "No decision records yet."

4. Preview and download work unchanged; the preview dialog title shows the filename, which already includes `-adr-`.

## Scope Limits

- don't change the ADR or spec tasks or routes
- don't add ADR editing
- don't add a separate tab

## Check When Done

- "Generate decision records" creates an ADR that appears in the list with an ADR badge.
- Filters show specs, ADRs, or both.
- Generate Spec still works exactly as before.
- `npm run build` passes.
