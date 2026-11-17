"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";

import type { ImageFormat } from "@/lib/export-image";

export type ExportCanvasImage = (format: ImageFormat, fileBaseName: string) => Promise<void>;

// Same pattern as hooks/use-canvas-import.ts: the navbar's Export menu lives in EditorShell, outside
// React Flow's provider, so the canvas registers its export handler in a ref EditorShell provides.
export const CanvasExportContext = createContext<RefObject<ExportCanvasImage | null> | null>(null);

export function useRegisterCanvasExport(handler: ExportCanvasImage) {
  const exportRef = useContext(CanvasExportContext);

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = handler;
    return () => {
      if (exportRef.current === handler) exportRef.current = null;
    };
  });
}
