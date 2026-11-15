Let users generate, list, and download infrastructure-as-code bundles from the editor.

## Billing Deferred

Billing and usage limits (specs 34–39) are deferred. Until they are implemented:

- skip the 402 "Team plan" message and upgrade link; generation is available to everyone, and failures show the generic error message

## Implementation

1. Add the list and download routes.
   - `GET /api/projects/[projectId]/iac`: `{ bundles: [{ id, format, fileCount, filename, createdAt }] }`, newest first, max 50, `cache-control: private, no-store`
   - `GET /api/projects/[projectId]/iac/[bundleId]/download`: authenticate, use `projectAccessError` like the spec download route, check the bundle belongs to the project, stream the Blob with `content-type: application/zip`, `content-disposition: attachment; filename="{slug}-{terraform|bicep}-{YYYY-MM-DD}.zip"`, `cache-control: private, no-store`, and `x-content-type-options: nosniff`
   - filename helper in `lib/iac-bundle.ts`

2. Add the dialog.
   - "Infrastructure as code…" item in the Export menu (spec 50) opens `components/editor/iac-dialog.tsx`, built on `EditorDialog`
   - format choice: Terraform, plus Bicep only for Azure projects; a project without AWS, Azure, or GCP shows "Set a cloud provider in Design context first"
   - "Generate" posts to `/api/ai/iac`, gets the token, and follows the run with `useRealtimeRun` (`skipColumns: ["payload"]`)
   - when it finishes, reload the list and show the run's `notes`
   - 402 shows: "Infrastructure code is available on the Team plan." with the upgrade link

3. List bundles.
   - rows with format badge, file count, and date, each with a download link (same pattern as the Specs tab)
   - loading, empty, and error states
   - a fixed note: "Generated code must be reviewed before use. MindMesh never applies it to your cloud."

## Scope Limits

- don't preview files inside the app
- don't push code to GitHub
- don't change the IaC task

## Check When Done

- Users can generate a bundle from the Export menu and download it as a zip.
- Bicep is only offered for Azure projects.
- Free workspaces see the Team-plan message.
- The download route enforces access and returns a zip attachment.
- `npm run build` passes.
