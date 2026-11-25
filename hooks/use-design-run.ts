"use client";

import { useEffect, useRef, useState } from "react";

import type { SendChatMessage } from "@/hooks/use-ai-chat";
import type { AiActivity } from "@/hooks/use-ai-status";
import { designRunMessage, type FinishedRun } from "@/lib/ai-status";
import { postJson } from "@/lib/post-json";

// The run this browser started; only its starter can read it.
export interface ActiveRun {
  runId: string;
}

export interface DesignPromptOptions {
  // Selected canvas nodes the prompt is about (spec 48).
  focusNodeIds?: string[];
  // Research best practices first (spec 70).
  research?: boolean;
  // Called once the prompt is in the chat, e.g. to clear the input.
  onPosted?: () => void;
}

interface UseDesignRunOptions {
  // The project ID, which is also the Liveblocks room ID; undefined outside a project.
  projectId: string | undefined;
  sendChat: SendChatMessage;
  // Shared by everyone in the room: the latest status message and whether a run is active.
  activity: AiActivity;
}

/**
 * The design send flow shared by the AI sidebar and the canvas's node toolbar: post the prompt to
 * the room's chat, start a design run, follow it in real time, then post its outcome. Lives in
 * EditorShell, which also renders the polling fallback (RunPoller) for activeRun with finishRun.
 */
export function useDesignRun({ projectId, sendChat, activity }: UseDesignRunOptions) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  // Set synchronously, so a double click can't start two runs before the next render.
  const isStarting = useRef(false);
  // Read when the run ends, so the final message can reuse the agent's own summary.
  const latestStatus = useRef(activity.latest);
  // onComplete can fire again when the subscription stops; one final message per run.
  const finishedRunId = useRef<string | null>(null);
  // This browser's run, or one started by someone else in the room (seen through AI presence).
  const isBusy = isSending || activeRun !== null || activity.active;

  useEffect(() => {
    latestStatus.current = activity.latest;
  }, [activity.latest]);

  // Called by the realtime subscription and by the polling fallback; the first to see the run
  // finish posts the final message, once.
  const finishRun = (run: (FinishedRun & { id: string }) | undefined, err?: Error) => {
    const message = designRunMessage(run, err, latestStatus.current);
    if (!message) return;
    if (run && finishedRunId.current === run.id) return;
    if (run) finishedRunId.current = run.id;
    // Everyone in the room sees the outcome in ai-chat; the canvas already updated through Liveblocks.
    void sendChat(message, "assistant").catch((sendErr: unknown) => console.error(sendErr));
    setActiveRun(null);
  };

  async function sendDesignPrompt(rawPrompt: string, { focusNodeIds, research = false, onPosted }: DesignPromptOptions = {}) {
    const prompt = rawPrompt.trim();
    if (!prompt || !projectId || isBusy || isStarting.current) return;
    isStarting.current = true;
    setIsSending(true);
    setSendError(null);
    try {
      try {
        await sendChat(prompt);
      } catch (err) {
        // The chat itself is unreachable, so this error can't go into it.
        console.error(err);
        setSendError("Couldn't send your message. Try again.");
        return;
      }
      onPosted?.();

      let runId: string;
      try {
        // POST /api/ai/design also needs projectId; here the room ID is the project ID.
        ({ runId } = await postJson<{ runId: string }>("/api/ai/design", {
          prompt,
          roomId: projectId,
          projectId,
          research,
          ...(focusNodeIds?.length ? { focusNodeIds } : {}),
        }));
      } catch (err) {
        console.error(err);
        await sendChat("Couldn't start the design. Try again.", "assistant").catch(console.error);
        return;
      }
      setActiveRun({ runId });
    } finally {
      isStarting.current = false;
      setIsSending(false);
    }
  }

  return { sendDesignPrompt, finishRun, activeRun, isSending, isBusy, sendError };
}

export type DesignRun = ReturnType<typeof useDesignRun>;
