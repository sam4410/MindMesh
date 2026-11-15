Let users set a project's design context when creating it and change it later from the editor.

## Implementation

1. Add a select component.
   - add the shadcn Select with `npx shadcn@latest add select` (a new file in `components/ui`; don't edit existing ones)

2. Extend the create project dialog.
   - in `components/editor/project-dialogs.tsx`, under the name field, add an optional "Design context" section with four selects: Cloud provider, Architecture style, Industry, Project type
   - options come from `lib/design-context.ts`; each select has a "Not set" option
   - send `designContext` with the existing `POST /api/projects` request
   - creating a project with nothing selected still works as today

3. Show the context in the editor.
   - in `components/editor/editor-navbar.tsx`, under the project name, show the context as small muted chips (`formatDesignContext` pieces), or "Add design context" when empty
   - pass the context from the workspace page data into the navbar

4. Edit the context.
   - clicking the chips opens a "Design context" dialog built on `EditorDialog` with the same four selects
   - Save sends `PATCH /api/projects/[projectId]` with `designContext`, then calls `router.refresh()`
   - show an inline error if the request fails

## Scope Limits

- don't sync context changes live to other open tabs; collaborators see it after reload
- don't change AI behavior, templates, or specs yet
- don't add free-text context

## Notes

- Follow `context/ui-context.md` for chip styling and muted text tokens.
- Keep the create dialog compact: the context section can be collapsed by default with a "Add design context (optional)" toggle.

## Check When Done

- A project can be created with or without design context.
- The navbar shows the context chips and opens the edit dialog.
- Saving updates the project and the chips.
- `npm run build` passes.
