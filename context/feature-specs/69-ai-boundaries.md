Let the AI architect draw boundaries around groups of components, such as a PCI scope, a VNet/VPC, or a public/private trust zone, sized automatically to fit the components inside.

## Implementation

1. Add boundary actions to the design plan.
   - in `lib/design-actions.ts`, add to `designPlanSchema.actions`:
     - `addBoundary`: `{ type: "addBoundary", id, label: string, memberIds: string[], color }` (at least 1 member)
     - `updateBoundary`: `{ type: "updateBoundary", id, label: string | null, memberIds: string[] | null, color: color | null }` (null keeps the current value; OpenAI strict schema rules apply)
   - `memberIds` refer to existing node IDs or temporary IDs created earlier in the same response, resolved with the same `ids` map as edges

2. Size and place boundaries from their members.
   - in `applyDesignAction`, compute the members' bounding box from their positions and sizes, add 40px of padding on every side plus 28px at the top for the label, and create or resize a `boundary` node at that box with `zIndex: -1`
   - skip members that don't exist; skip the whole action (return null, counted as skipped) if no members remain
   - boundaries may overlap each other; nested boundaries are allowed
   - move the AI cursor to the boundary's top-left corner

3. Teach the agent when to use them.
   - in `trigger/design-agent.ts`, add to `SYSTEM_PROMPT`:
     - "Use addBoundary to group components that share a security, network, or compliance zone (for example a PCI scope, a private network, a public edge zone, or a region). Add boundaries after their members exist. Don't wrap the whole design in one boundary, and use at most 4 boundaries unless asked."
     - boundaries are never connected by edges
   - in `lib/design-context-prompts.ts`, change the finance rule's "clearly labeled PCI scope boundary" to require an `addBoundary` named "PCI scope" around the payment components, and the healthcare rule to require one named "PHI zone"
   - include existing boundaries in the "Current canvas" JSON with their member IDs (the nodes whose centers fall inside the boundary)

4. Include boundaries in specs.
   - in `trigger/generate-spec.ts`, list each boundary with the components inside it (computed the same way), under the architecture overview, and use them in the security and compliance discussion

## Scope Limits

- don't add true parent/child grouping; boundaries stay free-standing visuals (see spec 68)
- don't change Mermaid or draw.io exports here; when spec 51 is implemented, export boundaries as Mermaid `subgraph`s and draw.io containers
- don't change the canvas UI

## Check When Done

- A design request on a finance project produces a "PCI scope" boundary around the payment components, drawn behind them.
- Boundary actions that refer to missing nodes are skipped and reported like other skipped changes.
- Re-running a design on a canvas with boundaries keeps them (no duplicates).
- Specs list boundaries and the components inside each.
- `npm run build` passes and `trigger dev` picks up the task change.
