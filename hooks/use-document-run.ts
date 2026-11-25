"use client";

import { useRef, useState } from "react";

import { postJson } from "@/lib/post-json";

// What the user is told when a step fails; each caller words them for its document.
export interface DocumentRunMessages {
  startFailed: string;
  runFailed: string;
  lostTrack: string;
}

interface UseDocumentRunOptions {
  // "/api/ai/spec" or "/api/ai/adr".
  triggerRoute: string;
  messages: DocumentRunMessages;
  // Called once a run succeeds; the Specs tab reloads its list.
  onSuccess: () => void;
}

// Starts a document run (spec or ADR), then follows it with a RunPoller, which the caller renders
// from `activeRun` and `finishRun`.
// shortcut: a 402 limit_reached (spec 37) gets the generic startFailed message until billing returns.
export function useDocumentRun({ triggerRoute, messages, onSuccess }: UseDocumentRunOptions) {
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<{ runId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Each run is handled once.
  const finishedRunId = useRef<string | null>(null);
  const isRunning = isStarting || activeRun !== null;

  const finishRun = (run: { id: string; isCompleted: boolean; isSuccess: boolean } | undefined, err?: Error) => {
    if (run && finishedRunId.current === run.id) return;
    if (run) finishedRunId.current = run.id;
    if (run?.isSuccess) {
      setNotice(null);
      onSuccess();
    } else if (run?.isCompleted) {
      setNotice(messages.runFailed);
    } else if (err) {
      setNotice(messages.lostTrack);
    } else {
      return;
    }
    setActiveRun(null);
  };

  // Posts the body to the trigger route, then follows the run. Resolves once it's started.
  async function start(body: unknown) {
    if (isRunning) return;
    setNotice(null);
    setIsStarting(true);
    try {
      const { runId } = await postJson<{ runId: string }>(triggerRoute, body);
      setActiveRun({ runId });
    } catch (err) {
      console.error(err);
      setNotice(messages.startFailed);
    } finally {
      setIsStarting(false);
    }
  }

  return { start, isRunning, notice, activeRun, finishRun };
}
