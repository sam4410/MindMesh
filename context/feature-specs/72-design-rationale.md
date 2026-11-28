Record why the AI designed what it drew: a reason on every component it adds or changes, and a log of the key design decisions, shown on the canvas and reused by decision records.

## Why

The design agent already reasons before it draws (`plan` in `designPlanSchema`), but that text is only logged. Teams can't tell why a component or service was chosen, so they can't check, defend or challenge the design. Reasons captured while the agent designs are more faithful than explanations generated afterwards.

## Implementation

1. Extend the plan schema: `lib/design-actions.ts`.
   - `designPlanSchema` field order becomes `plan`, `decisions`, `summary`, `actions` (the model writes in order, so it decides before it acts)
   - `decisions`: up to 8 `{ title: string; choice: string; reasons: string[]; alternatives: string[]; tradeoffs: string; nodeIds: string[]; sourceUrls: string[] }` (OpenAI strict rules: no optional fields; arrays may be empty)
   - `addNode` and `updateNodeData` actions gain `reason: string | null`: why this component and this service over the likely alternatives, at most two sentences; `null` for layout or label-only changes
   - `nodeIds` use the same ids as the actions (new nodes) or the canvas ids in square brackets (existing nodes)

2. Update the design agent: `inngest/design-agent.ts`.
   - prompt rules:
     - `reason` ties the choice to the request, the design context, or the research notes; no generic praise
     - `decisions`: the 3–8 choices that shape the design (architecture pattern, data stores, messaging, network and security boundaries, scaling), each with 1–3 reasons, 0–3 alternatives considered, and one sentence of trade-offs
     - `sourceUrls` only from the research notes' sources; empty when there was no research
   - the `plan` step gives each decision a `randomUUID()` id, so the ids stay stable across step replays
   - the `apply` step:
     - writes `rationale` into the data of each node an action with a non-empty `reason` adds or changes (see step 3), with the ids of the decisions that list that node
     - after applying, saves the decisions in the same step (it holds the model-id → node-id map): node ids are mapped and dropped when the node no longer exists, `sourceUrls` are kept only when they match this run's research sources (stored as `{ title, url }`, https only)
     - text limits on save: title 120, choice 300, each reason 300 (max 3), each alternative 120 (max 3), trade-offs 300, at most 20 node ids; longer text is cut, not rejected
     - a failed save is logged and doesn't fail the run (the canvas changes are already applied)
   - the run output (`completeTaskRun`) adds `decisions: { title, choice }[]` for the chat reply

3. Store reasons on nodes: `types/canvas.ts`.
   - `CanvasNodeData.rationale?: { reason: string; decisionIds: string[]; recordedLabel: string; recordedService: string | null; recordedAt: string; runId: string }` (reason at most 500 characters)
   - Liveblocks syncs it to every collaborator, and canvas saves and version history keep it with the node
   - any collaborator can edit node data, so treat `rationale` like labels: untrusted plain text, never rendered as HTML or Markdown

4. Add the decision log.
   - `prisma/models/design-decision.prisma`: `DesignDecision` with `id String @id` (the uuid from the plan step), `projectId` → `Project` with `onDelete: Cascade`, `runId String`, `title`, `choice`, `reasons String[]`, `alternatives String[]`, `tradeoffs String`, `nodeIds String[]`, `sources Json` (`{ title, url }[]`), `createdAt DateTime @default(now())`, `@@index([projectId, createdAt])`
   - add `designDecisions DesignDecision[]` to `Project`; migration `add_design_decision`
   - `GET /api/projects/[projectId]/decisions`: newest first, at most 100, access checked with `getAccessibleProject` and `projectAccessError`, `cache-control: private, no-store`

5. Show the reasons.
   - node toolbar (`components/editor/node-ai-toolbar.tsx`): a "Why?" button when exactly one node is selected, opening a popover with:
     - the reason, and the titles of its linked decisions
     - "Recorded by MindMesh AI" with the date
     - "This component changed after the reason was recorded." when its label or service differs from `recordedLabel` or `recordedService`
     - without a rationale: "No reason recorded. A person added it, or it predates recorded reasons."
   - Architect chat: the design run's reply (`designRunMessage` in `lib/ai-status.ts`) adds "Key decisions:" with up to 5 lines "- {title}: {choice}" after the summary and before the sources, within the chat length limit
   - `components/editor/design-decisions-dialog.tsx` on `EditorDialog`, opened by a "Design decisions" button in the Specs tab under "Generate decision records":
     - each decision shows its title, choice, reasons, alternatives considered, trade-offs, date, and sources as external links
     - its components appear as chips; clicking one closes the dialog and calls `focusNodes` (spec 53), or says "That component is no longer on the canvas."
     - loading, empty ("No recorded decisions yet. Design something with the AI architect.") and error states

6. Reuse the log in decision records.
   - `POST /api/ai/adr` loads the project's 30 newest decisions and adds them to the payload as `recordedDecisions` (optional in `generateSpecPayloadSchema`, so older runs still parse; the spec route doesn't send them)
   - `inngest/generate-adr.ts`: the prompt lists them and says to base the records on them, keep their reasons and alternatives, and mark any reason not in the log as inferred

## Scope Limits

- don't generate reasons afterwards for nodes people drew or that predate this feature
- don't record reasons for individual edges; decisions cover flows
- don't edit or delete decisions in the UI; they go with the project
- don't change the review, cost, IaC or spec tasks
- keep reasons short; they add output tokens to every design run

## Check When Done

- A design run stores a reason on each node it adds or changes, and up to 8 decisions linked to those nodes.
- "Why?" shows a node's reason and decisions, flags a node changed after its reason was recorded, and says so when there's no reason.
- The design run's chat reply lists its key decisions.
- The Design decisions dialog lists decisions, focuses their components, and shows sources only from research runs.
- Decision records generated after a design run use its recorded decisions.
- Collaborators see the same reasons; decisions are deleted with the project.
- `npm run build` passes and the Inngest dev server registers the updated design agent.
