Generate infrastructure-as-code (Terraform or Bicep) from the design, packaged as a zip in Vercel Blob. Backend only.

## Implementation

1. Add the `IacBundle` model.
   - `prisma/models/iac-bundle.prisma`:
     - `id String @id @default(uuid())` (chosen before upload)
     - `projectId` → `Project`, `onDelete: Cascade`
     - `format IacFormat` enum `TERRAFORM | BICEP`
     - `filePath String` (Blob URL), `fileCount Int`
     - `createdAt DateTime @default(now())`
     - `@@index([projectId, createdAt])`
   - add `iacBundles IacBundle[]` to `Project`; migration `add_iac_bundle`
   - Blob path `iac/{projectId}/{bundleId}.zip`, private; helpers in `lib/iac-bundle.ts`

2. Create the task: `trigger/generate-iac.ts`.
   - `schemaTask` id `generate-iac`, payload `{ projectId, nodes, edges, designContext, format }`
   - format rules: AWS and GCP → `TERRAFORM` only; Azure → `TERRAFORM` or `BICEP`; any other provider → `AbortTaskRunError`
   - OpenAI with `Output.object` and schema `{ files: { path: string; content: string }[]; notes: string[] }`
   - prompt rules:
     - one module or file per component, plus `main`, `variables`, and `outputs` (Terraform) or `main.bicep` with modules (Bicep)
     - use the node `service` IDs to pick resource types
     - no secrets, keys, or account IDs in code; use variables with placeholder defaults
     - add a `README.md` explaining how to review, plan, and apply
   - validate every path: relative, no `..`, no leading `/`, allowed extensions `.tf`, `.tfvars.example`, `.bicep`, `.json`, `.md`; max 40 files, max 200 KB total; abort with a clear error otherwise
   - zip with `fflate` (`zipSync`, install it), upload to Blob, create the `IacBundle` row (delete the Blob if the row fails), and `metadata.set("bundleId", id)`
   - return `{ bundleId, notes }`

3. Add the routes and metering.
   - `POST /api/ai/iac` with `{ roomId, nodes, edges, format }` and `POST /api/ai/iac/token`, mirroring the review routes; 400 early for an invalid provider and format combination
   - add `IAC` to `TaskRunKind` (migration `add_iac_task_kind`) and `iacRunsPerMonth` to `PLANS` (Free 0, Team 50), so it is a paid feature
   - extend `DELETE /api/projects/[projectId]` to delete Blobs under `iac/{projectId}/`

## Scope Limits

- don't run `terraform validate`, `plan`, or `apply`; generated code is for review only
- don't build download routes or UI (next spec)
- don't support Pulumi or CloudFormation

## Check When Done

- An Azure project can generate Terraform or Bicep; AWS and GCP generate Terraform; others are rejected.
- The zip in Blob contains only valid paths and includes a README.
- Free workspaces get 402; Team workspaces can generate.
- `npm run build` passes and `trigger dev` registers the task.
