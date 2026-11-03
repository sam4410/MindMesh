"use client";

import type { ReactFlowInstance } from "@xyflow/react";
import { useEffect } from "react";

// Shared by the control bar and the shortcuts so zooming feels the same either way.
export const ZOOM_ANIMATION = { duration: 200 };

interface KeyboardShortcutsOptions {
  reactFlow: Pick<ReactFlowInstance, "zoomIn" | "zoomOut">;
  onUndo: () => void;
  onRedo: () => void;
}

// Typing a label must not zoom the canvas or undo canvas history.
function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select") !== null)
  );
}

export function useKeyboardShortcuts({ reactFlow, onUndo, onRedo }: KeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) onRedo();
          else onUndo();
        } else if (key === "y") {
          event.preventDefault();
          onRedo();
        }
        // Other modifier combos (including Ctrl/Cmd +/- browser zoom) stay with the browser.
        return;
      }
      if (event.altKey) return;

      if (key === "+" || key === "=") {
        event.preventDefault();
        reactFlow.zoomIn(ZOOM_ANIMATION);
      } else if (key === "-") {
        event.preventDefault();
        reactFlow.zoomOut(ZOOM_ANIMATION);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reactFlow, onUndo, onRedo]);
}
