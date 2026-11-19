"use client";

import { useThreads } from "@liveblocks/react";
import { Composer, Thread } from "@liveblocks/react-ui";
import { NodeToolbar, Position } from "@xyflow/react";
import { Loader2, X } from "lucide-react";
import { createContext, type KeyboardEvent } from "react";

// Unresolved thread count per node ID, read once by the canvas (spec 54) so nodes don't each
// subscribe to the room's threads.
export const CommentCountsContext = createContext<ReadonlyMap<string, number>>(new Map());

interface NodeCommentsProps {
  nodeId: string;
  // How the node is named in the dialog title.
  nodeName: string;
  onClose: () => void;
}

// The comments popover, anchored to the right of the node; it closes when the node is deselected.
export function NodeComments({ nodeId, nodeName, onClose }: NodeCommentsProps) {
  const { threads, isLoading, error } = useThreads({ query: { metadata: { nodeId } } });

  function handleKeyDown(event: KeyboardEvent) {
    // Keys typed here mustn't reach the canvas: Backspace on a focused button would delete the node.
    event.stopPropagation();
    if (event.key === "Escape" && !event.defaultPrevented) onClose();
  }

  return (
    // nowheel/nokey: scrolling and typing here mustn't zoom the canvas or trigger its shortcuts.
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Right} offset={12} className="nodrag nopan nowheel nokey">
      <div
        role="dialog"
        aria-label={`Comments on ${nodeName}`}
        onKeyDown={handleKeyDown}
        className="flex max-h-[min(480px,70vh)] w-80 flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-surface-border py-2 pr-2 pl-4">
          <h2 className="truncate text-sm font-medium text-copy-primary">Comments on {nodeName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-copy-muted transition-colors outline-none hover:bg-elevated hover:text-copy-primary focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="flex items-center gap-2 px-4 py-3 text-xs text-copy-muted">
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              Loading comments…
            </p>
          ) : error ? (
            <p role="alert" className="px-4 py-3 text-xs text-error">
              Couldn&apos;t load comments. Try again.
            </p>
          ) : threads.length === 0 ? (
            <p className="px-4 py-3 text-xs text-copy-muted">No comments yet. Start a thread below.</p>
          ) : (
            threads.map((thread) => (
              <Thread key={thread.id} thread={thread} className="border-b border-surface-border" />
            ))
          )}
        </div>
        {/* A new thread, tied to this node. */}
        <Composer metadata={{ nodeId }} autoFocus className="border-t border-surface-border" />
      </div>
    </NodeToolbar>
  );
}
