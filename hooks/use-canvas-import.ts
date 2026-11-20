"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";

import type { CanvasSnapshot } from "@/lib/canvas-snapshot";

// Replaces the canvas with a template's nodes and edges, or a restored version's (spec 56).
export type ImportTemplate = (canvas: CanvasSnapshot) => void;

// The navbar lives in EditorShell while the canvas (and its Liveblocks room) sits deep inside the
// page, so the canvas registers its import handler in a ref that EditorShell provides.
export const CanvasImportContext = createContext<RefObject<ImportTemplate | null> | null>(null);

export function useRegisterCanvasImport(handler: ImportTemplate) {
  const importRef = useContext(CanvasImportContext);

  // Re-registered every render so the handler always sees the current nodes and edges.
  useEffect(() => {
    if (!importRef) return;
    importRef.current = handler;
    return () => {
      if (importRef.current === handler) importRef.current = null;
    };
  });
}
