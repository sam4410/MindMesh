import { NodeToolbar, Position } from "@xyflow/react";
import { Cloud, Copy, MessageSquare, TrendingUp, type LucideIcon } from "lucide-react";

import { useAiPromptActions } from "@/hooks/use-ai-chat";
import type { CanvasNode } from "@/types/canvas";

// POST /api/ai/design accepts up to this many focus nodes.
const MAX_FOCUS_NODES = 20;

const QUICK_ACTIONS: { label: string; icon: LucideIcon; prompt: (labels: string) => string }[] = [
  {
    label: "Use a managed service",
    icon: Cloud,
    prompt: (labels) => `Replace ${labels} with the most suitable managed service for this project.`,
  },
  {
    label: "Add redundancy",
    icon: Copy,
    prompt: (labels) => `Make ${labels} highly available with redundancy and failover.`,
  },
  {
    label: "Scale 10x",
    icon: TrendingUp,
    prompt: (labels) => `Change ${labels} to handle 10x the current traffic.`,
  },
];

const BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs whitespace-nowrap text-copy-secondary transition-colors outline-none hover:bg-elevated hover:text-copy-primary focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50";

// "Orders DB", "Orders DB and Cache", "Orders DB, Cache and Queue"; unlabeled nodes go by their shape.
function formatLabels(nodes: CanvasNode[]) {
  const names = nodes.map((node) => node.data.label.trim() || `the unlabeled ${node.data.shape}`);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

interface NodeAiToolbarProps {
  // The currently selected nodes; the toolbar hides when there are none.
  nodes: CanvasNode[];
  // A design run is active in the room.
  disabled: boolean;
}

// AI actions for the selection (spec 48), below it so it doesn't cover the color toolbar above a
// single selected node. Each action is about the selected nodes only.
export function NodeAiToolbar({ nodes, disabled }: NodeAiToolbarProps) {
  const { sendDesignPrompt, openAiPrompt, isDesignBusy } = useAiPromptActions();
  if (nodes.length === 0) return null;

  const ids = nodes.map((node) => node.id);
  const labels = formatLabels(nodes);
  const tooMany = nodes.length > MAX_FOCUS_NODES;
  // isDesignBusy also covers this browser's send before the run's AI presence appears.
  const isWorking = disabled || isDesignBusy;
  const isDisabled = isWorking || tooMany;
  const title = isWorking
    ? "MindMesh is working…"
    : tooMany
      ? `Select at most ${MAX_FOCUS_NODES} nodes`
      : undefined;

  return (
    <NodeToolbar nodeId={ids} isVisible position={Position.Bottom} offset={12} className="nodrag nopan">
      <div
        role="toolbar"
        aria-label="AI actions for the selection"
        title={title}
        className="flex items-center gap-0.5 rounded-full border border-surface-border bg-surface/90 p-1 shadow-lg backdrop-blur"
      >
        {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={isDisabled}
            onClick={() => void sendDesignPrompt(prompt(labels), ids)}
            className={BUTTON_CLASS}
          >
            <Icon aria-hidden className="h-3.5 w-3.5 text-ai-text" />
            {label}
          </button>
        ))}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-surface-border" />
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => openAiPrompt({ text: `About ${labels}: `, focusNodeIds: ids })}
          className={BUTTON_CLASS}
        >
          <MessageSquare aria-hidden className="h-3.5 w-3.5 text-ai-text" />
          Ask AI…
        </button>
      </div>
    </NodeToolbar>
  );
}
