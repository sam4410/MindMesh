Replace the fixed starter chips in the AI sidebar with prompt suggestions that match the project's design context and the state of the canvas.

## Implementation

1. Add `lib/prompt-suggestions.ts`.
   - `getPromptSuggestions(ctx: DesignContext, hasNodes: boolean): string[]` returns at most 4 suggestions
   - empty canvas: starter prompts built from the context, e.g.
     - finance + Azure: "Design a PCI-compliant payments platform on Azure"
     - data-warehouse + GCP: "Design a batch and streaming data warehouse on BigQuery"
     - no context: keep the current three starters (e-commerce backend, chat app, CI/CD pipeline)
   - canvas has nodes: refinement prompts, e.g.
     - always available: "Add monitoring and alerting", "Add disaster recovery across regions"
     - finance: "Make the payment flow PCI compliant"; healthcare: "Add audit logging for patient data access"
     - microservices: "Add an API gateway and service-to-service authentication"
   - pure function, no API calls

2. Use it in the sidebar.
   - in `components/editor/ai-sidebar.tsx`:
     - empty state: show `getPromptSuggestions(ctx, false)` as the starter chips
     - when the canvas has nodes and the chat isn't busy: show up to 3 refinement chips above the input
   - clicking a chip fills the textarea and focuses it; it doesn't send automatically
   - pass the design context into `AiSidebar` from `editor-shell.tsx`; use `getCanvas()` to know whether the canvas has nodes

3. Self-check.
   - add a small assert-based check for `getPromptSuggestions` (no context, finance, data warehouse, has nodes) run with `node --import tsx --test`

## Scope Limits

- don't generate suggestions with AI
- don't change the design task or API
- don't change chat message storage

## Check When Done

- Starter chips match the project's context, and fall back to the current ones with no context.
- Refinement chips appear once the canvas has nodes.
- Clicking a chip fills the input without sending.
- `npm run build` passes.
