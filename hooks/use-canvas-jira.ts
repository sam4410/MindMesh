"use client";

import { createContext, useContext, useEffect, type RefObject } from "react";

// Opens the "Create Jira issues" dialog for every component on the canvas (spec 62).
export type OpenJiraIssues = () => void;

// Same pattern as hooks/use-canvas-focus.ts: the navbar's Export menu lives in EditorShell, outside
// React Flow's provider, so the canvas registers its opener in a ref EditorShell provides.
export const CanvasJiraContext = createContext<RefObject<OpenJiraIssues | null> | null>(null);

export function useRegisterCanvasJira(handler: OpenJiraIssues) {
  const jiraRef = useContext(CanvasJiraContext);

  // Re-registered every render so the handler always sees the current nodes.
  useEffect(() => {
    if (!jiraRef) return;
    jiraRef.current = handler;
    return () => {
      if (jiraRef.current === handler) jiraRef.current = null;
    };
  });
}
