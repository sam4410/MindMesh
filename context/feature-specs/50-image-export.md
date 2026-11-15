Let users export the canvas as a PNG or SVG image for slides and documents.

## Implementation

1. Add an Export menu.
   - add the shadcn Dropdown Menu with `npx shadcn@latest add dropdown-menu` (new file in `components/ui`; don't edit existing ones)
   - add an "Export" button with a download icon to `components/editor/editor-navbar.tsx`, between Templates and Share
   - menu items for this unit: "PNG image" and "SVG image"; later specs add more items to the same menu

2. Add `lib/export-image.ts`.
   - install `html-to-image` (the approach React Flow documents for image export)
   - `exportCanvasImage(format: "png" | "svg", nodes, fileBaseName)`:
     - compute bounds with `getNodesBounds(nodes)` and the transform with `getViewportForBounds(bounds, width, height, 0.5, 2, 0.1)` from `@xyflow/react`
     - render `.react-flow__viewport` with `toPng` / `toSvg` at that transform, image size fitted to the content (max 4096px on the long side), `pixelRatio: 2` for PNG
     - background: the canvas background token color from `globals.css`
     - exclude overlays with the `filter` option: minimap, controls, live cursors, selection toolbars
   - download as `${toSlug(projectName)}-diagram.png` or `.svg`

3. Wire it.
   - the Export menu calls `exportCanvasImage` with the current nodes from React Flow (`useReactFlow().getNodes()`)
   - disable the image items when the canvas is empty
   - show a short error message if rendering fails

## Scope Limits

- don't add PDF export
- don't export through the server
- don't change canvas rendering

## Check When Done

- PNG and SVG downloads contain the whole diagram with labels and edge labels, and no cursors or controls.
- The image is sharp at 2x and fits the content.
- Items are disabled on an empty canvas.
- `npm run build` passes.
