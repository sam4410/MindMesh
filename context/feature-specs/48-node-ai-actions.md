Let users select nodes and ask the AI to change just those nodes, from a small toolbar on the canvas.

## Implementation

1. Accept focus nodes in the API and task.
   - `POST /api/ai/design` accepts optional `focusNodeIds: string[]` (max 20, each a non-empty string up to 120 characters); 400 otherwise
   - pass it in the task payload
   - in `trigger/design-agent.ts`, when `focusNodeIds` is set, add to the user message: "Focus on these nodes: {id: label, …}. Change only these nodes and their direct connections unless the request says otherwise."
   - the task change is limited to this prompt text

2. Expose a send function to the canvas.
   - add `sendDesignPrompt(prompt: string, focusNodeIds?: string[])` to the AI chat context in `hooks/use-ai-chat.ts`, backed by the same send flow `ai-sidebar.tsx` uses (post to chat, `POST /api/ai/design`, follow the run)
   - move the shared send logic out of `ai-sidebar.tsx` so both callers use one implementation

3. Add the selection toolbar.
   - in `components/editor/collaborative-canvas.tsx`, when one or more nodes are selected, show a toolbar with `NodeToolbar` from `@xyflow/react`, following the pattern of `node-color-toolbar.tsx`
   - actions:
     - "Use a managed service": "Replace {labels} with the most suitable managed service for this project."
     - "Add redundancy": "Make {labels} highly available with redundancy and failover."
     - "Scale 10x": "Change {labels} to handle 10x the current traffic."
     - "Ask AI…": opens the AI sidebar with the input prefilled "About {labels}: " and remembers the focus nodes for that message
   - disable the actions while the AI is busy (`useSyncAiActivity`)

## Scope Limits

- don't add an "explain" answer mode; the design agent only edits the canvas
- don't change the design action schema
- don't add keyboard shortcuts

## Check When Done

- Selecting a node shows the AI toolbar.
- "Scale 10x" on a database changes that part of the design and leaves unrelated nodes alone.
- "Ask AI…" opens the sidebar with a prefilled, focused prompt.
- Actions are disabled while a design run is active.
- `npm run build` passes.
