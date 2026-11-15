Export the canvas as Mermaid and draw.io files, so designs can live in docs, wikis, and other diagram tools.

## Implementation

1. Mermaid exporter: `lib/exporters/mermaid.ts`.
   - `toMermaid(nodes: CanvasNode[], edges: CanvasEdge[]): string` producing `flowchart LR`
   - node shapes:

     | Canvas shape | Mermaid |
     | --- | --- |
     | rectangle | `id["label"]` |
     | diamond | `id{"label"}` |
     | circle | `id(("label"))` |
     | pill | `id(["label"])` |
     | cylinder | `id[("label")]` |
     | hexagon | `id{{"label"}}` |

   - edges: `a -->|"label"| b`, or `a --> b` without a label
   - sanitize IDs to `[A-Za-z0-9_]` and keep them unique; escape `"` in labels as `#quot;`; replace newlines with `<br/>`
   - append `style id fill:#…,color:#…` lines from node colors

2. draw.io exporter: `lib/exporters/drawio.ts`.
   - `toDrawio(nodes, edges): string` producing an uncompressed `<mxfile><diagram><mxGraphModel>` document
   - vertex styles: rectangle `rounded=1`, diamond `rhombus`, circle `ellipse`, pill `rounded=1;arcSize=50`, cylinder `shape=cylinder3`, hexagon `shape=hexagon`
   - `fillColor` and `fontColor` from node data; geometry from position, width, and height
   - edges as `edge="1"` cells with `source`, `target`, and `value` = label
   - XML-escape all text

3. Add menu items.
   - in the Export menu: "Mermaid (.mmd)", "draw.io (.drawio)", and "Copy Mermaid" (to the clipboard, with a "Copied" confirmation)
   - files are named `${toSlug(projectName)}-diagram.mmd` / `.drawio`

4. Self-check.
   - `lib/exporters/exporters.test.ts` with `node:test` and `assert`: every shape maps correctly, quotes and `<`/`&` are escaped, edge labels appear, IDs with hyphens are sanitized
   - run with `node --import tsx --test lib/exporters/exporters.test.ts`

## Scope Limits

- don't add import from Mermaid or draw.io
- don't add PlantUML or other formats
- don't change canvas data

## Check When Done

- The Mermaid file renders in the Mermaid Live Editor with the right shapes and labels.
- The draw.io file opens in diagrams.net with positions, colors, and edge labels.
- The self-check passes.
- `npm run build` passes.
