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

import { serializeCanvas } from "@/lib/canvas-snapshot";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

const SAVE_DEBOUNCE_MS = 5000;

// "idle": nothing has changed since the canvas opened.
export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error";
// "loading" and "failed" hold saves back: writing now could replace the saved canvas with a blank one.
export type CanvasLoadState = "loading" | "ready" | "failed";

// The Save button lives in the navbar (EditorShell) while the canvas sits deep inside the page.
export const CanvasSaveContext = createContext<{
  setStatus: (status: CanvasSaveStatus) => void;
  saveRef: RefObject<(() => void) | null>;
}>({ setStatus: () => {}, saveRef: { current: null } });

interface UseCanvasAutosaveOptions {
  projectId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  loadState: CanvasLoadState;
  onRetryLoad: () => void;
}

// shortcut: every open tab saves the same synced state, so N tabs mean N writes per change; elect one saver if Blob costs matter.
export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  loadState,
  onRetryLoad,
}: UseCanvasAutosaveOptions) {
  const { setStatus, saveRef } = useContext(CanvasSaveContext);
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
    // The first state after loading is what's already saved or live in the room, so it isn't an edit.
    if (lastSaved.current === null) {
      lastSaved.current = serialized;
      return;
    }
    if (serialized === lastSaved.current && !isSaving.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    // Each change clears the previous timer, so saves wait for a pause in editing.
    const timer = setTimeout(save, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [serialized, loadState, save, setStatus]);

  useEffect(() => {
    if (loadState === "failed") setStatus("error");
    else if (loadState === "loading") setStatus("idle");
  }, [loadState, setStatus]);

  // The navbar's Save button saves right away, or retries a failed load first.
  useEffect(() => {
    saveRef.current = () => {
      if (loadState === "failed") onRetryLoad();
      else if (loadState === "ready") void save(true);
    };
    return () => {
      saveRef.current = null;
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
