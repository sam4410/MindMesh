Label starter templates with the design context taxonomy and let users filter the template gallery.

## Implementation

1. Add labels to templates.
   - in `components/editor/starter-templates.ts` add `labels: Partial<DesignContext>` to `CanvasTemplate`, using IDs from `lib/design-context.ts`
   - label the existing templates:
     - Microservices: `cloudProvider: "agnostic"`, `architectureStyle: "microservices"`, `projectType: "backend-platform"`
     - CI/CD pipeline: `cloudProvider: "agnostic"`, `projectType: "cicd-pipeline"`
     - Event-driven system: `cloudProvider: "agnostic"`, `architectureStyle: "event-driven"`, `projectType: "backend-platform"`

2. Add filters to the gallery.
   - in `components/editor/starter-templates-modal.tsx` add a filter row with four selects (Cloud, Style, Industry, Project type), each with "All"
   - a template matches when every selected filter equals its label; a template without that label doesn't match a selected filter, except `agnostic` templates also match any cloud filter
   - default the filters to the current project's design context, passed in from `editor-shell.tsx`
   - add a "Clear filters" button and an empty state: "No templates match these filters."

3. Show labels on cards.
   - show the template's labels as small chips under its description

## Scope Limits

- don't add new templates (next spec)
- don't change import behavior or previews
- don't persist filter choices

## Check When Done

- Every template has labels.
- The gallery opens pre-filtered to the project's context and can be cleared.
- Cards show label chips.
- Import still replaces the canvas as before.
- `npm run build` passes.
