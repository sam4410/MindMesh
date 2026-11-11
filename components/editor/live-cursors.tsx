"use client";

import { useAuth } from "@clerk/nextjs";
import { shallow, useOthersMapped } from "@liveblocks/react";
import { useStore, ViewportPortal } from "@xyflow/react";
import { Loader2 } from "lucide-react";

// Rendered inside <ReactFlow>. Cursors are stored in flow coordinates, so ViewportPortal places
// them on the same spot of the diagram for everyone, whatever each person's pan and zoom.
export function LiveCursors() {
  const { userId } = useAuth();
  const zoom = useStore((state) => state.transform[2]);
  const others = useOthersMapped(
    (other) => ({
      id: other.id,
      cursor: other.presence.cursor,
      thinking: other.presence.thinking,
      ...other.info,
    }),
    shallow
  );

  return (
    <ViewportPortal>
      {others.map(([connectionId, other]) => {
        // useOthers never includes this tab; the id check also hides the user's other tabs.
        if (!other.cursor || other.id === userId) return null;
        return (
          <div
            key={connectionId}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 origin-top-left"
            // Counter-scale so the cursor stays the same size at any zoom.
            style={{ transform: `translate(${other.cursor.x}px, ${other.cursor.y}px) scale(${1 / zoom})` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow">
              <path
                d="M1 1 L1 16 L5 12 L8 19 L11 17.5 L8 11 L14 11 Z"
                fill={other.color}
                stroke="var(--bg-base)"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{ backgroundColor: other.color }}
              className="absolute top-4 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap text-(color:--bg-base)"
            >
              {other.name}
              {/* Presence from older clients may lack the field, which counts as not thinking. */}
              {other.thinking === true && (
                <Loader2 aria-label="thinking" className="h-3 w-3 animate-spin" />
              )}
            </span>
          </div>
        );
      })}
    </ViewportPortal>
  );
}
