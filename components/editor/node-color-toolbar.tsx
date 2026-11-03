import { NodeToolbar, Position } from "@xyflow/react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { NODE_COLORS, type NodeColor } from "@/types/canvas";

interface NodeColorToolbarProps {
  // The node's current fill, used to mark the active swatch.
  activeFill: string;
  onSelect: (color: NodeColor) => void;
}

// Rendered from inside a node; NodeToolbar shows it only while that node is the single selected one.
export function NodeColorToolbar({ activeFill, onSelect }: NodeColorToolbarProps) {
  return (
    <NodeToolbar position={Position.Top} offset={12} className="nodrag nopan">
      <div
        role="toolbar"
        aria-label="Node color"
        className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-lg backdrop-blur"
      >
        {NODE_COLORS.map((color) => {
          const isActive = color.fill.toLowerCase() === activeFill.toLowerCase();
          return (
            <button
              key={color.name}
              type="button"
              title={color.name}
              aria-label={color.name}
              aria-pressed={isActive}
              onClick={() => onSelect(color)}
              style={{ backgroundColor: color.fill, "--swatch-text": color.text } as CSSProperties}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border border-surface-border-subtle transition-shadow duration-150 outline-none",
                // Tight glow in the pair's text color: a 2px halo plus a small 6px blur.
                "hover:shadow-[0_0_0_2px_color-mix(in_oklab,var(--swatch-text)_35%,transparent),0_0_6px_color-mix(in_oklab,var(--swatch-text)_50%,transparent)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                isActive && "ring-2 ring-(--swatch-text) ring-offset-2 ring-offset-(--bg-surface)"
              )}
            >
              {/* The dot previews the label color paired with this fill. */}
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color.text }} />
            </button>
          );
        })}
      </div>
    </NodeToolbar>
  );
}
