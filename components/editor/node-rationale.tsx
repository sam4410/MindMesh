"use client";

import { useRoom } from "@liveblocks/react";
import { NodeToolbar, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";

import { readRationale } from "@/lib/design-rationale";
import type { CanvasNode } from "@/types/canvas";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

interface NodeRationaleProps {
  node: CanvasNode;
  // How the node is named in the popover title.
  nodeName: string;
  onClose: () => void;
}

// "Why?" for one node (spec 72): the reason the AI recorded when it added or changed it, anchored
// to the right of the node like the comments popover. Plain text only: collaborators can edit it.
export function NodeRationale({ node, nodeName, onClose }: NodeRationaleProps) {
  const room = useRoom();
  const rationale = readRationale(node.data.rationale);
  // Titles of the decisions the reason links to; null until loaded (or if loading failed).
  const [titles, setTitles] = useState<string[] | null>(null);
  const decisionKey = rationale?.decisionIds.join(",") ?? "";
  const isStale =
    rationale !== null &&
    (node.data.label !== rationale.recordedLabel || (node.data.service ?? null) !== rationale.recordedService);

  useEffect(() => {
    if (!decisionKey) return;
    const wanted = new Set(decisionKey.split(","));
    const controller = new AbortController();
    // shortcut: looks titles up in the newest 100 decisions, so much older ones show no titles.
    fetch(`/api/projects/${room.id}/decisions`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Decision list failed with status ${res.status}`);
        return res.json() as Promise<{ decisions: { id: string; title: string }[] }>;
      })
      .then(({ decisions }) => setTitles(decisions.filter((d) => wanted.has(d.id)).map((d) => d.title)))
      .catch((err) => {
        // The reason still shows; only the decision titles are missing.
        if (!controller.signal.aborted) console.error(err);
      });
    return () => controller.abort();
  }, [room.id, decisionKey]);

  function handleKeyDown(event: KeyboardEvent) {
    // Keys typed here mustn't reach the canvas: Backspace on a focused button would delete the node.
    event.stopPropagation();
    if (event.key === "Escape" && !event.defaultPrevented) onClose();
  }

  return (
    // nowheel/nokey: scrolling and typing here mustn't zoom the canvas or trigger its shortcuts.
    <NodeToolbar nodeId={node.id} isVisible position={Position.Right} offset={12} className="nodrag nopan nowheel nokey">
      <div
        role="dialog"
        aria-label={`Why ${nodeName}`}
        onKeyDown={handleKeyDown}
        className="flex max-h-[min(480px,70vh)] w-80 flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-surface-border py-2 pr-2 pl-4">
          <h2 className="truncate text-sm font-medium text-copy-primary">Why {nodeName}?</h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-copy-muted transition-colors outline-none hover:bg-elevated hover:text-copy-primary focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-xs">
          {rationale ? (
            <>
              <p className="text-sm whitespace-pre-wrap text-copy-primary">{rationale.reason}</p>
              {titles && titles.length > 0 && (
                <div>
                  <p className="font-medium text-copy-secondary">Decisions</p>
                  <ul className="mt-1 list-disc pl-4 text-copy-secondary">
                    {titles.map((title, index) => (
                      <li key={index}>{title}</li>
                    ))}
                  </ul>
                </div>
              )}
              {isStale && <p className="text-warning">This component changed after the reason was recorded.</p>}
              <p className="text-copy-muted">
                Recorded by MindMesh AI on{" "}
                <time dateTime={rationale.recordedAt}>{DATE_FORMAT.format(new Date(rationale.recordedAt))}</time>
              </p>
            </>
          ) : (
            <p className="text-copy-muted">No reason recorded. A person added it, or it predates recorded reasons.</p>
          )}
        </div>
      </div>
    </NodeToolbar>
  );
}
