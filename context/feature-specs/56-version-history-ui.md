Add a version history dialog to the editor: save named versions of the canvas and restore an earlier one.

## Implementation

1. Add the History entry point.
   - add a "History" button with a clock icon to `components/editor/editor-navbar.tsx`, next to Save
   - it opens `components/editor/version-history-dialog.tsx`, built on `EditorDialog`

2. Save a version.
   - a name input (default: "Version {date time}") and a "Save version" button
   - sends `POST /api/projects/[projectId]/versions` with the current canvas from `canvasRef` (the same source the Specs tab uses through `getCanvas`)
   - disabled while the canvas is still loading; shows the 409 limit message when returned

3. List versions.
   - load `GET .../versions` when the dialog opens
   - each row: name, author, relative time, node count, and Restore; Delete shown only to owners and admins
   - loading, empty, and error states like the Specs tab

4. Restore a version.
   - Restore asks for confirmation: "Replace the canvas for everyone in this project?"
   - before restoring, save the current canvas as a version named "Before restore – {date time}", so the restore can be undone
   - fetch the snapshot with `GET .../versions/[versionId]`, then replace the canvas through the existing template import path (`CanvasImportContext` in `hooks/use-canvas-import.ts`), which clears nodes and edges and adds the snapshot's, then fits the view
   - autosave persists the restored canvas as it does for any change

## Scope Limits

- don't add version diffs or previews
- don't add automatic versions on a timer
- don't change the version API

## Check When Done

- A user can save a named version and see it in the list.
- Restoring replaces the canvas for every connected collaborator and creates a "Before restore" version first.
- Owners and admins can delete versions; others can't see the button.
- `npm run build` passes.
