Add a boundary shape to the canvas: a dashed, labeled rectangle drawn behind other components to mark a group, such as a PCI scope, a VNet/VPC, a trust zone, or a region. This unit covers manual boundaries only; spec 69 lets the AI draw them.

## Implementation

1. Add the shape to the shared schema.
   - add `"boundary"` to `NODE_SHAPES` in `types/canvas.ts`, so boundaries are ordinary `canvasNode` nodes and templates, autosave, Liveblocks sync, and spec input keep one schema (architecture invariant 5)
   - in `lib/canvas-shapes.ts`, add `boundary: { width: 480, height: 320 }` to `SHAPE_SIZES`
   - boundaries can be resized up to 2400 × 1600; other shapes keep their current limits

2. Draw it.
   - in `components/editor/shape-graphic.tsx`, render `boundary` as a rounded rectangle with a 2px **dashed** border in the node's text color and a very faint fill (the node color at about 10% opacity), so components inside stay readable
   - in `components/editor/canvas-node.tsx`, for boundaries:
     - show the label in the top-left corner, small and medium weight, instead of centered
     - hide the connection handles (boundaries don't take edges)
     - keep the existing `NodeResizer` and label editing
   - set `zIndex: -1` on every boundary node when it is created, so nodes and edges always render above it; a click on empty space inside the boundary selects the boundary

3. Let users add one.
   - the shape panel already lists every shape in `NODE_SHAPES`; give the boundary item a dashed-square icon and the label "Boundary"
   - dropping a boundary creates it at the drop point with `zIndex: -1`, the default size, and the label "Boundary"
   - the color toolbar works as for other shapes, so teams can color-code zones

4. Keep the AI from using it for now.
   - in `lib/design-actions.ts`, the `shape` enum the AI can choose from excludes `"boundary"`, so the design agent can't add a boundary through `addNode`/`updateNodeData` until spec 69 adds a dedicated action
   - spec generation (`specNodeSchema`) accepts boundaries; the spec task treats a boundary as "a group containing the components inside its area", not as a component

## Scope Limits

- don't make boundaries move their contents (no React Flow `parentId` sub-flows); moving a boundary moves only the boundary
- don't let edges connect to boundaries
- don't change exports (Mermaid, draw.io) or templates in this unit

## Notes

- `shortcut:` boundaries are free-standing visuals, not true groups. Upgrade to React Flow sub-flows (`parentId`, `extent: "parent"`) if users ask to drag a group with its contents; that touches the AI grid layout, templates, and exports.

## Check When Done

- "Boundary" appears in the shape panel and drops as a dashed, labeled rectangle.
- Nodes and edges render above a boundary, and it can be resized, recolored, relabeled, and deleted.
- Boundaries have no connection handles.
- Boundaries sync to collaborators and survive autosave and reload.
- The design agent can't create boundaries yet.
- `npm run build` passes.
