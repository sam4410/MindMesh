"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { AnyTask } from "@trigger.dev/sdk";
import { useRef, useState } from "react";

import { postJson } from "@/lib/post-json";

// What the user is told when a step fails; each caller words them for its document.
export interface DocumentRunMessages {
  startFailed: string;
  // The run started, but no token means its progress can't be followed.
  tokenFailed: string;
  runFailed: string;
  lostTrack: string;
}

interface UseDocumentRunOptions {
  // e.g. "/api/ai/spec" and "/api/ai/spec/token", or the /api/ai/adr pair.
  triggerRoute: string;
  tokenRoute: string;
  messages: DocumentRunMessages;
  // Called once a run succeeds; the Specs tab reloads its list.
  onSuccess: () => void;
}

// The run this browser started, and the token that lets it read only that run.
interface ActiveRun {
  runId: string;
  publicToken: string;
}

// Starts a document task (spec or ADR), then follows the run: start → token → useRealtimeRun, with
// the RunPoller fallback, which the caller renders from `activeRun` and `finishRun`.
// shortcut: a 402 limit_reached (spec 37) gets the generic startFailed message until billing returns.
export function useDocumentRun({ triggerRoute, tokenRoute, messages, onSuccess }: UseDocumentRunOptions) {
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // onComplete can fire again when the subscription stops; handle each run once.
  const finishedRunId = useRef<string | null>(null);
  const isRunning = isStarting || activeRun !== null;

  // Called by the realtime subscription and by the polling fallback; each run is handled once.
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

  useRealtimeRun<AnyTask>(activeRun?.runId, {
    accessToken: activeRun?.publicToken,
    enabled: activeRun !== null,
    // The output is the whole document; the list only needs to know the run finished.
    skipColumns: ["payload", "output"],
    onComplete: (run, err) => finishRun(run, err),
  });

  // Posts the body to the trigger route, then follows the run. Resolves once it's started.
  async function start(body: unknown) {
    if (isRunning) return;
    setNotice(null);
    setIsStarting(true);
    let runId: string;
    try {
      ({ runId } = await postJson<{ runId: string }>(triggerRoute, body));
    } catch (err) {
      console.error(err);
      setNotice(messages.startFailed);
      setIsStarting(false);
      return;
    }
    try {
      const { token } = await postJson<{ token: string }>(tokenRoute, { runId });
      setActiveRun({ runId, publicToken: token });
    } catch (err) {
      console.error(err);
      setNotice(messages.tokenFailed);
    } finally {
      setIsStarting(false);
    }
  }

  return { start, isRunning, notice, activeRun, finishRun };
}
