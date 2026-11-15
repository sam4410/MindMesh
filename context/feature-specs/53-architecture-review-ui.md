Show architecture reviews in the AI sidebar, and let users jump from a finding to the affected nodes.

## Implementation

1. Add a Review tab.
   - in `components/editor/ai-sidebar.tsx` add a third tab, "Review", after Specs; keep it mounted like the Specs tab
   - create `components/editor/review-tab.tsx` with props `{ projectId, isActive, getCanvas }`

2. Run a review.
   - "Review architecture" button; guard an empty or still-loading canvas the same way the Specs tab does
   - `POST /api/ai/review` with the canvas nodes and edges, then `POST /api/ai/review/token`
   - follow the run with `useRealtimeRun`; keep `skipColumns: ["payload"]` only, since the output is the review
   - show a spinner while running, and handle 402 `limit_reached` with the upgrade message from spec 37

3. Show the result.
   - summary paragraph
   - five pillar rows, each with name, score as 1–5 filled dots, and notes
   - findings grouped by severity (high first), each showing title, pillar, detail, and recommendation
   - keep the latest result in component state; it is lost on reload (state that in a muted note under the result)

4. Focus nodes from a finding.
   - add a canvas focus API: a `CanvasFocusContext` in `hooks/` registered by `collaborative-canvas.tsx`, exposing `focusNodes(ids: string[])`
   - `focusNodes` selects those nodes and calls `fitView({ nodes, padding: 0.4, duration: 300 })`
   - clicking a finding with node IDs calls it; findings without nodes aren't clickable

## Scope Limits

- don't persist or share reviews
- don't auto-fix findings (users can use the node AI actions from spec 48)
- don't change the review task

## Check When Done

- The Review tab runs a review and shows scores and findings.
- Clicking a finding selects and zooms to its nodes.
- The limit message appears when the plan limit is reached.
- `npm run build` passes.
