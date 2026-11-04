"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { ShapeGraphic } from "@/components/editor/shape-graphic";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates";
import { Button } from "@/components/ui/button";
import { EDGE_COLOR } from "@/types/canvas";

interface StarterTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (template: CanvasTemplate) => boolean;
}

export function StarterTemplatesModal({ open, onOpenChange, onImport }: StarterTemplatesModalProps) {
  const [importError, setImportError] = useState<string | null>(null);

  return (
    <EditorDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setImportError(null);
        onOpenChange(nextOpen);
      }}
      title="Starter templates"
      description="Importing a template replaces everything on the canvas. You can undo it."
      className="sm:max-w-3xl"
    >
      <ul className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
        {CANVAS_TEMPLATES.map((template) => (
          <li
            key={template.id}
            className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-3"
          >
            <TemplatePreview template={template} />
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-medium text-copy-primary">{template.name}</h3>
              <p className="text-xs text-copy-muted">{template.description}</p>
            </div>
            <Button
              className="rounded-xl"
              onClick={() => {
                if (onImport(template)) {
                  setImportError(null);
                  onOpenChange(false);
                } else {
                  setImportError("The canvas isn't ready yet. Please try importing again shortly.");
                }
              }}
            >
              <Download className="h-4 w-4" />
              Import
            </Button>
          </li>
        ))}
      </ul>
      {importError && (
        <p role="alert" className="mt-3 text-sm text-error">
          {importError}
        </p>
      )}
    </EditorDialog>
  );
}

const PREVIEW = { width: 256, height: 144, padding: 12 };

// Plain DOM, no React Flow: the diagram is scaled to fit a fixed viewport, edges are straight
// lines between node centers, and nodes reuse the canvas shape drawing.
function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const boxes = template.nodes.map((node) => ({
    id: node.id,
    data: node.data,
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? 0,
    height: node.height ?? 0,
  }));
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const boundsWidth = Math.max(...boxes.map((box) => box.x + box.width)) - minX;
  const boundsHeight = Math.max(...boxes.map((box) => box.y + box.height)) - minY;
  const scale = Math.min(
    (PREVIEW.width - PREVIEW.padding * 2) / boundsWidth,
    (PREVIEW.height - PREVIEW.padding * 2) / boundsHeight
  );
  const centers = new Map(
    boxes.map((box) => [box.id, { x: box.x - minX + box.width / 2, y: box.y - minY + box.height / 2 }])
  );

  return (
    <div
      aria-hidden
      style={{ width: PREVIEW.width, height: PREVIEW.height }}
      className="relative mx-auto max-w-full overflow-hidden rounded-xl border border-surface-border bg-base"
    >
      <div
        className="absolute origin-top-left"
        style={{
          left: (PREVIEW.width - boundsWidth * scale) / 2,
          top: (PREVIEW.height - boundsHeight * scale) / 2,
          width: boundsWidth,
          height: boundsHeight,
          transform: `scale(${scale})`,
        }}
      >
        <svg className="absolute inset-0 overflow-visible" width={boundsWidth} height={boundsHeight}>
          {template.edges.map((edge) => {
            const from = centers.get(edge.source);
            const to = centers.get(edge.target);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={EDGE_COLOR}
                strokeOpacity={0.45}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {boxes.map((box) => (
          <div
            key={box.id}
            className="absolute"
            style={{ left: box.x - minX, top: box.y - minY, width: box.width, height: box.height }}
          >
            <ShapeGraphic shape={box.data.shape} color={box.data.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
