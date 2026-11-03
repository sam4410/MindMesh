import { useCanRedo, useCanUndo } from "@liveblocks/react";
import { Panel, useReactFlow } from "@xyflow/react";
import { Maximize, Redo2, Undo2, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ZOOM_ANIMATION } from "@/hooks/use-keyboard-shortcuts";

interface CanvasControlsProps {
  onUndo: () => void;
  onRedo: () => void;
}

// Rendered inside <ReactFlow>; the Panel pins it to the bottom-left, level with the shape panel.
export function CanvasControls({ onUndo, onRedo }: CanvasControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
    <Panel
      position="bottom-left"
      role="toolbar"
      aria-label="Canvas controls"
      className="flex items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1.5 backdrop-blur"
    >
      <ControlButton icon={ZoomOut} label="Zoom out (-)" onClick={() => zoomOut(ZOOM_ANIMATION)} />
      <ControlButton icon={Maximize} label="Fit view" onClick={() => fitView(ZOOM_ANIMATION)} />
      <ControlButton icon={ZoomIn} label="Zoom in (+)" onClick={() => zoomIn(ZOOM_ANIMATION)} />
      <div aria-hidden className="mx-1 h-5 w-px bg-surface-border" />
      <ControlButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
      <ControlButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />
    </Panel>
  );
}

interface ControlButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ControlButton({ icon: Icon, label, onClick, disabled }: ControlButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      // Button dims itself when disabled.
      disabled={disabled}
      className="rounded-full text-copy-muted hover:text-copy-primary"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
