"use client";

import { useCreateFeed, useCreateFeedMessage, useFeedMessages, useRoom } from "@liveblocks/react";
import { createContext, useContext, useEffect, useMemo, type RefObject } from "react";

import { AI_AGENT } from "@/lib/ai-status";
import { AI_CHAT_FEED_ID, chatMessageSchema, type ChatMessage } from "@/types/tasks";

export interface ChatEntry extends ChatMessage {
  id: string;
}

// "assistant" posts as MindMesh: the browser that started a design run reports its outcome.
export type SendChatMessage = (content: string, role?: ChatMessage["role"]) => Promise<void>;

// The AI sidebar lives in EditorShell, outside the Liveblocks room, so the canvas hands it the
// room's chat and a send function (same pattern as CanvasSaveContext).
export const AiChatContext = createContext<{
  setMessages: (messages: ChatEntry[]) => void;
  sendRef: RefObject<SendChatMessage | null>;
}>({ setMessages: () => {}, sendRef: { current: null } });

function hasCode(err: unknown, code: string) {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === code;
}

// Called inside the room. Before the first message the feed doesn't exist yet, which counts as empty.
export function useSyncAiChat() {
  const { setMessages, sendRef } = useContext(AiChatContext);
  const room = useRoom();
  // shortcut: shows the most recent page of messages only; add "load earlier" via fetchMore if
  // conversations get long enough to need history.
  const { messages } = useFeedMessages(AI_CHAT_FEED_ID);
  const createFeed = useCreateFeed();
  const createFeedMessage = useCreateFeedMessage();

  const chat = useMemo(() => {
    const valid: (ChatEntry & { createdAt: number })[] = [];
    for (const message of messages ?? []) {
      const parsed = chatMessageSchema.safeParse(message.data);
      if (parsed.success) valid.push({ ...parsed.data, id: message.id, createdAt: message.createdAt });
    }
    // Server time orders the conversation; a sender's own clock could be off.
    return valid.sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  useEffect(() => {
    setMessages(chat);
  }, [chat, setMessages]);

  useEffect(() => {
    sendRef.current = async (content, role = "user") => {
      const self = room.getSelf();
      if (!self) throw new Error("Not connected to the room");
      const data = chatMessageSchema.parse({
        sender:
          role === "assistant"
            ? { id: AI_AGENT.id, name: AI_AGENT.info.name }
            : { id: self.id, name: self.info.name },
        role,
        content,
        timestamp: Date.now(),
      });
      try {
        await createFeedMessage(AI_CHAT_FEED_ID, data);
      } catch (err) {
        // The room's first message creates the feed; someone else may create it at the same moment.
        if (!hasCode(err, "FEED_NOT_FOUND")) throw err;
        await createFeed(AI_CHAT_FEED_ID).catch((createErr: unknown) => {
          if (!hasCode(createErr, "FEED_ALREADY_EXISTS")) throw createErr;
        });
        await createFeedMessage(AI_CHAT_FEED_ID, data);
      }
    };
    return () => {
      sendRef.current = null;
    };
  }, [room, createFeed, createFeedMessage, sendRef]);

  // Leaving the room (or switching projects) must not leave the old room's chat behind.
  useEffect(() => () => setMessages([]), [setMessages]);
}
