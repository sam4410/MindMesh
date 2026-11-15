Add saved canvas versions: a Prisma model, Blob storage, and API routes to create, list, and read versions. No UI and no canvas changes in this unit.

## Implementation

1. Add the `ProjectVersion` model.
   - `prisma/models/project-version.prisma`:
     - `id String @id @default(uuid())` (chosen before upload, like `ProjectSpec`)
     - `projectId` → `Project`, `onDelete: Cascade`
     - `name String`
     - `createdById String` (Clerk user ID) and `createdByName String`
     - `filePath String` (Blob URL)
     - `nodeCount Int`
     - `createdAt DateTime @default(now())`
     - `@@index([projectId, createdAt])`
   - add `versions ProjectVersion[]` to `Project`
   - create migration `add_project_version`

2. Store snapshots in Vercel Blob.
   - path `versions/{projectId}/{versionId}.json`, `access: "private"`, `addRandomSuffix: false`
   - content uses the same format as the canvas snapshot (`serializeCanvas` in `lib/canvas-snapshot.ts`)
   - add `versionBlobFolder(projectId)` and `versionBlobPath(projectId, versionId)` to a new `lib/project-version.ts`

3. Add the routes.
   - `POST /api/projects/[projectId]/versions` with `{ name, nodes, edges }`:
     - authenticate and check access
     - name: trimmed, 1–80 characters
     - validate the canvas with the same check the canvas `PUT` route uses (`isCanvasSnapshot`)
     - limit 50 versions per project: return 409 `{ error: "Version limit reached. Delete an old version first." }`
     - upload to Blob, then create the row; if the row fails, delete the Blob
     - return 201 with the version summary
   - `GET /api/projects/[projectId]/versions`: newest first, max 50, `{ versions: [{ id, name, createdByName, createdAt, nodeCount }] }`, `cache-control: private, no-store`
   - `GET /api/projects/[projectId]/versions/[versionId]`: returns the snapshot JSON after checking the version belongs to the project
   - `DELETE /api/projects/[projectId]/versions/[versionId]`: owner or admin only (`canManageProject`); deletes the Blob, then the row

4. Clean up on project delete.
   - in `DELETE /api/projects/[projectId]`, delete Blobs under `versionBlobFolder(projectId)` with the same paged `list` + `del` loop used for specs

## Scope Limits

- don't build UI or restore into the live canvas (next spec)
- don't add diffs between versions
- don't save versions automatically

## Check When Done

- Versions can be created, listed, read, and deleted through the API, with access checks.
- The 51st version returns 409.
- Deleting a project removes its version Blobs.
- `npm run build` passes.
