"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";

import type { CanvasTemplate } from "@/components/editor/starter-templates";

export type ImportTemplate = (template: CanvasTemplate) => void;

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
