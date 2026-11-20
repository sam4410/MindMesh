"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";

import { serializeCanvas, type CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

const SAVE_DEBOUNCE_MS = 5000;

// "idle": nothing has changed since the canvas opened.
export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error";
// "loading" and "failed" hold saves back: writing now could replace the saved canvas with a blank one.
export type CanvasLoadState = "loading" | "ready" | "failed";

// The Save button lives in the navbar (EditorShell) while the canvas sits deep inside the page.
// canvasRef hands the live canvas to EditorShell too (the AI sidebar's spec generation reads it);
// it's null until the canvas has loaded. setHasNodes tells EditorShell when the loaded canvas gains
// its first node or loses its last, so the AI sidebar re-renders its prompt suggestions.
// setIsLoaded does the same when the canvas finishes loading (the version history dialog waits for it).
export const CanvasSaveContext = createContext<{
  setStatus: (status: CanvasSaveStatus) => void;
  saveRef: RefObject<(() => void) | null>;
  canvasRef: RefObject<CanvasSnapshot | null>;
  setHasNodes: (hasNodes: boolean) => void;
  setIsLoaded: (isLoaded: boolean) => void;
}>({
  setStatus: () => {},
  saveRef: { current: null },
  canvasRef: { current: null },
  setHasNodes: () => {},
  setIsLoaded: () => {},
});

interface UseCanvasAutosaveOptions {
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  loadState: CanvasLoadState;
  // True when the canvas changed while it was loading, so the state it finished with isn't saved yet.
  unsavedOnLoad?: boolean;
  onRetryLoad: () => void;
}

// shortcut: every open tab saves the same synced state, so N tabs mean N writes per change; elect one saver if Blob costs matter.
export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  loadState,
  unsavedOnLoad = false,
  onRetryLoad,
}: UseCanvasAutosaveOptions) {
  const { setStatus, saveRef, canvasRef, setHasNodes, setIsLoaded } = useContext(CanvasSaveContext);
  const url = `/api/projects/${projectId}/canvas`;
  const serialized = useMemo(() => serializeCanvas(nodes, edges), [nodes, edges]);
  const latest = useRef(serialized);
  // What the blob is known to hold; null until the canvas has finished loading.
  const lastSaved = useRef<string | null>(null);
  const isSaving = useRef(false);
  const saveAgain = useRef(false);
  const isUnmounted = useRef(false);

  const save = useCallback(
    async (force = false) => {
      // One request at a time, so an older save can't land after a newer one.
      if (isSaving.current) {
        saveAgain.current = true;
        return;
      }
      if (!force && latest.current === lastSaved.current) {
        setStatus("saved");
        return;
      }
      isSaving.current = true;
      setStatus("saving");
      try {
        do {
          saveAgain.current = false;
          const body = latest.current;
          const res = await fetch(url, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body,
          });
          if (!res.ok) throw new Error(`Canvas save failed with status ${res.status}`);
          lastSaved.current = body;
        } while (saveAgain.current);
        // Otherwise a debounce timer is still pending and will report the result.
        if (!isUnmounted.current && latest.current === lastSaved.current) setStatus("saved");
      } catch (err) {
        console.error(err);
        if (!isUnmounted.current) setStatus("error");
      } finally {
        isSaving.current = false;
      }
    },
    [url, setStatus]
  );

  useEffect(() => {
    latest.current = serialized;
    if (loadState !== "ready") return;
    // The first state after loading is what's already saved or live in the room, so it isn't an
    // edit, unless someone changed the canvas while it loaded: then it gets saved like any edit.
    if (lastSaved.current === null) {
      if (!unsavedOnLoad) {
        lastSaved.current = serialized;
        return;
      }
      // Matches no canvas, so the save below goes ahead.
      lastSaved.current = "";
    }
    if (serialized === lastSaved.current && !isSaving.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    // Each change clears the previous timer, so saves wait for a pause in editing.
    const timer = setTimeout(save, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [serialized, loadState, unsavedOnLoad, save, setStatus]);

  useEffect(() => {
    if (loadState === "failed") setStatus("error");
    else if (loadState === "loading") setStatus("idle");
  }, [loadState, setStatus]);

  // Not tied to the save status: edits made while the canvas loads don't change it.
  const hasNodes = loadState === "ready" && nodes.length > 0;
  useEffect(() => {
    setHasNodes(hasNodes);
  }, [hasNodes, setHasNodes]);
  useEffect(() => () => setHasNodes(false), [setHasNodes]);
  const isLoaded = loadState === "ready";
  useEffect(() => {
    setIsLoaded(isLoaded);
  }, [isLoaded, setIsLoaded]);
  useEffect(() => () => setIsLoaded(false), [setIsLoaded]);

  // The navbar's Save button saves right away, or retries a failed load first.
  useEffect(() => {
    saveRef.current = () => {
      if (loadState === "failed") onRetryLoad();
      else if (loadState === "ready") void save(true);
    };
    // Before loading finishes the room may look empty while a saved canvas is still on its way.
    canvasRef.current = loadState === "ready" ? { nodes, edges } : null;
    return () => {
      saveRef.current = null;
      canvasRef.current = null;
    };
  });

  // Don't drop edits still waiting on the debounce when leaving the canvas or closing the tab.
  useEffect(() => {
    isUnmounted.current = false;
    function flush() {
      if (lastSaved.current === null || latest.current === lastSaved.current) return;
      lastSaved.current = latest.current;
      // shortcut: browsers refuse keepalive bodies over 64 KB, so large canvases skip this; the room still holds the edit.
      void fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: latest.current,
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      isUnmounted.current = true;
      setStatus("idle");
    };
  }, [url, setStatus]);
}
