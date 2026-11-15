Attach a cloud service to canvas nodes, so a node knows it is "Azure Cosmos DB" and shows a provider badge. The field is optional, so existing nodes and templates stay valid.

## Implementation

1. Add a service catalog in `lib/cloud-services.ts`.
   - `CLOUD_SERVICES: readonly { id: string; provider: "aws" | "azure" | "gcp"; name: string; role: string }[]`
   - IDs look like `azure.cosmos-db`, `aws.dynamodb`, `gcp.bigquery`
   - cover every cell of the mapping table in spec 42 (about 14 roles × 3 providers)
   - export `CLOUD_SERVICE_IDS` (for a Zod enum) and `getCloudService(id)`

2. Extend the node data.
   - in `types/canvas.ts` add `service?: string` to `CanvasNodeData`
   - keep it optional: user-drawn nodes and templates without it must keep working (architecture invariant 5)

3. Let the AI set it.
   - in `lib/design-actions.ts` add `service: z.enum(CLOUD_SERVICE_IDS).nullable()` to the `addNode` and `updateNodeData` actions (nullable, not optional, for the OpenAI strict schema)
   - `applyDesignAction` writes `service` into node data when it isn't null
   - in `lib/design-context-prompts.ts`, when a cloud provider is set, add: "Set `service` on each node that maps to a managed service, using an ID from the catalog."
   - pass the catalog IDs for the chosen provider into the rules block, so the model picks from a short list

4. Render it.
   - in `components/editor/canvas-node.tsx`, when `data.service` is set, show a small provider badge (AWS / Azure / GCP text badge in the provider's brand color) and the service name in muted text under the label
   - the node size doesn't change; the label still wraps as before

5. Include it in specs.
   - add `service: z.string().optional()` to `specNodeSchema` in `types/tasks.ts`
   - list the service name next to the node in the spec task's context

## Scope Limits

- don't add official provider icon packs; text badges only
- don't add a manual service picker UI
- don't change templates (later spec)

## Check When Done

- AI-generated nodes in a cloud-specific project carry a `service` ID and show the provider badge.
- Old nodes, user-drawn nodes, and templates render unchanged.
- Specs mention the managed service for each node.
- `npm run build` passes.
