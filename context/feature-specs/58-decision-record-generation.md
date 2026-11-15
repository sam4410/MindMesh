Generate architecture decision records (ADRs) from the design chat and canvas, stored alongside specs. Backend only.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- skip the usage check in `POST /api/ai/adr`, the `ADR` `TaskRunKind` value, and the `adrRunsPerMonth` plan limit (they depend on specs 34 and 36)
- create the `TaskRun` record the same way the spec routes do today

## Implementation

1. Store ADRs as a kind of spec.
   - in `prisma/models/project-spec.prisma` add `kind SpecKind @default(SPEC)` with enum `SpecKind { SPEC ADR }`
   - create migration `add_spec_kind`
   - update `specFilename` in `lib/project-spec.ts` to take the kind: `…-spec-…md` or `…-adr-…md`
   - Blob path is unchanged (`specs/{projectId}/{specId}.md`), so download and project deletion keep working

2. Share the save logic.
   - move `saveSpec` from `trigger/generate-spec.ts` into `lib/project-spec-store.ts` as `saveProjectDocument(projectId, markdown, kind)`
   - keep its behavior: check the project still exists, upload to Blob, create the row, delete the Blob if the row fails
   - `generate-spec` calls it with `SPEC`

3. Create the task: `trigger/generate-adr.ts`.
   - `schemaTask` id `generate-adr`, payload the same as `generate-spec` (`projectId`, `roomId`, `chatHistory`, `nodes`, `edges`, `designContext`)
   - Gemini via `@ai-sdk/google`, like `generate-spec`
   - the prompt finds 3–8 significant decisions in the chat and design (e.g. choice of database, messaging, cloud services, sync vs async)
   - one Markdown document; each record uses this structure: `## ADR-{n}: {title}`, Status (Accepted), Context, Decision, Alternatives considered, Consequences
   - if the chat has no clear decisions, record the decisions visible in the design and say they were inferred
   - run metadata and `metadata.set("specId", …)` as in `generate-spec`

4. Add the routes and metering.
   - `POST /api/ai/adr` and `POST /api/ai/adr/token`, mirroring the spec routes, including the usage check
   - add `ADR` to `TaskRunKind` (migration `add_adr_task_kind`) and `adrRunsPerMonth` to `PLANS` (Free 3, Team 100)
   - `GET /api/projects/[projectId]/specs` includes `kind` in each item

## Scope Limits

- don't build UI (next spec)
- don't change spec generation output
- don't add editing of ADRs

## Check When Done

- `POST /api/ai/adr` runs the task and saves an `ADR` row with a Markdown file.
- Spec generation still saves `SPEC` rows through the shared helper.
- The list route returns `kind`, and ADRs download with an `-adr-` filename.
- `npm run build` passes and `trigger dev` registers the task.
