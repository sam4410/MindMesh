"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";

// Selects the given nodes and zooms to them; returns false when none of them are on the canvas.
export type FocusNodes = (ids: string[]) => boolean;

// Same pattern as hooks/use-canvas-import.ts: the AI sidebar lives in EditorShell, outside React
// Flow's provider, so the canvas registers its focus handler in a ref EditorShell provides (spec 53).
export const CanvasFocusContext = createContext<RefObject<FocusNodes | null> | null>(null);

export function useRegisterCanvasFocus(handler: FocusNodes) {
  const focusRef = useContext(CanvasFocusContext);

  // Re-registered every render so the handler always sees the current nodes.
  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = handler;
    return () => {
      if (focusRef.current === handler) focusRef.current = null;
    };
  });
}

// For components outside the canvas, such as the Review tab: false when no canvas is registered.
export function useCanvasFocus() {
  const focusRef = useContext(CanvasFocusContext);
  return {
    focusNodes: (ids: string[]) => focusRef?.current?.(ids) ?? false,
  };
}
