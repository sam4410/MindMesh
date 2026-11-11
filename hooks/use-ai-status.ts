"use client";

import { useFeedMessages, useOthers } from "@liveblocks/react";
import { createContext, useContext, useEffect, useMemo } from "react";

import { AI_STATUS_FEED_ID, taskStatusMessageSchema, type TaskStatusMessage } from "@/types/tasks";

export interface AiActivity {
  // The newest valid message in the room's status feed, or null before the first one.
  latest: TaskStatusMessage | null;
  // Someone in the room (in practice the design agent) has thinking: true in presence.
  // Presence expires on its own, so a crashed task can't leave this stuck on.
  active: boolean;
}

export const NO_AI_ACTIVITY: AiActivity = { latest: null, active: false };

// The AI sidebar lives in EditorShell, outside the Liveblocks room, so the canvas hands it the
// room's AI activity through this setter (same pattern as CanvasSaveContext).
export const AiActivityContext = createContext<(activity: AiActivity) => void>(() => {});

// Called inside the room. Before the first generation the feed doesn't exist yet, which counts as empty.
export function useSyncAiActivity() {
  const setActivity = useContext(AiActivityContext);
  // Only the latest message is shown, so the first page is one message; live ones still arrive.
  const { messages } = useFeedMessages(AI_STATUS_FEED_ID, { limit: 1 });
  const active = useOthers((others) => others.some((other) => other.presence.thinking === true));

  const latest = useMemo(() => {
    const newestFirst = [...(messages ?? [])].sort((a, b) => b.createdAt - a.createdAt);
    for (const message of newestFirst) {
      const parsed = taskStatusMessageSchema.safeParse(message.data);
      if (parsed.success) return parsed.data;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    setActivity({ latest, active });
  }, [latest, active, setActivity]);

  // Leaving the room (or switching projects) must not leave the old room's status behind.
  useEffect(() => () => setActivity(NO_AI_ACTIVITY), [setActivity]);

  return active;
}
