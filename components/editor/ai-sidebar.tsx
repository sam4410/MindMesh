"use client";

import { useAuth } from "@clerk/nextjs";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Bot, Loader2, SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { SpecsTab } from "@/components/editor/specs-tab";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ChatEntry } from "@/hooks/use-ai-chat";
import type { AiActivity } from "@/hooks/use-ai-status";
import { designRunMessage } from "@/lib/ai-status";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import { postJson } from "@/lib/post-json";
import { cn } from "@/lib/utils";
import type { designAgent } from "@/trigger/design-agent";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage, type TaskStatusMessage } from "@/types/tasks";

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
];

// The spec's "accent" is the AI accent (indigo) here; the project's own `accent` utility is a
// shadcn surface color. Inactive tabs already use the muted text token; `!` beats tabs.tsx's
// dark: and hover: text/bg defaults so the active tab keeps the accent while hovered.
const TAB_TRIGGER =
  "rounded-lg data-active:border-transparent! data-active:bg-ai/15! data-active:text-ai-text!";

// Hours and minutes in the viewer's locale, e.g. "3:42 PM".
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

type SendMessage = (content: string, role?: ChatMessage["role"]) => Promise<void>;

// The run this browser started, and the token that lets it read only that run.
interface ActiveRun {
  runId: string;
  publicToken: string;
}

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  // Shared by everyone in the room: the latest status message and whether generation is active.
  activity: AiActivity;
  // The room's ai-chat feed, validated and in order.
  chatMessages: ChatEntry[];
  // The project ID, which is also the Liveblocks room ID.
  projectId: string;
  onSendMessage: SendMessage;
  // The live canvas, or null until it has loaded; spec generation sends it.
  getCanvas: () => CanvasSnapshot | null;
}

export function AiSidebar({
  isOpen,
  onClose,
  activity,
  chatMessages,
  projectId,
  onSendMessage,
  getCanvas,
}: AiSidebarProps) {
  const [tab, setTab] = useState("architect");
  return (
    <aside
      id="ai-sidebar"
      aria-label="AI workspace"
      inert={!isOpen}
      className={cn(
        // Floats over the canvas at every size; the canvas never resizes. Closed, it slides
        // far enough (3rem) that the shadow doesn't peek in from the edge either.
        "fixed top-19 right-3 bottom-3 z-40 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-surface-border bg-base/95 shadow-2xl backdrop-blur transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+3rem)]"
      )}
    >
      <header className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-subtle">
          <Bot className="h-4 w-4 text-ai-text" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-copy-primary">AI Workspace</h2>
          <p className="text-xs text-copy-muted">Collaborate with MindMesh</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close AI sidebar">
          <X />
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 mt-3 w-auto bg-subtle">
          <TabsTrigger value="architect" className={TAB_TRIGGER}>
            AI Architect
          </TabsTrigger>
          <TabsTrigger value="specs" className={TAB_TRIGGER}>
            Specs
          </TabsTrigger>
        </TabsList>
        {/* keepMounted so a half-typed prompt survives switching tabs. */}
        <TabsContent value="architect" keepMounted className="flex min-h-0 flex-col">
          <ArchitectTab
            projectId={projectId}
            messages={chatMessages}
            onSend={onSendMessage}
            activity={activity}
          />
        </TabsContent>
        {/* keepMounted so a running generation keeps its subscription; the list reloads on each visit. */}
        <TabsContent value="specs" keepMounted className="flex min-h-0 flex-col">
          <SpecsTab
            projectId={projectId}
            isActive={tab === "specs"}
            chatMessages={chatMessages}
            getCanvas={getCanvas}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// Compact strip above the input, shown only while a run is active (for every client in the room).
function StatusStrip({ latest }: { latest: TaskStatusMessage | null }) {
  // The newest message may still be the previous run's "completed" until this run reports in.
  const isCurrent = latest?.status === "started" || latest?.status === "processing";
  const text = isCurrent && latest.text ? latest.text : "MindMesh is working…";
  return (
    <div className="px-3 pt-2">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-accent-green/30 bg-base px-3 py-1.5 text-xs text-copy-secondary"
      >
        <span aria-hidden className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
        </span>
        <p className="min-w-0 truncate">{text}</p>
      </div>
    </div>
  );
}

interface ArchitectTabProps {
  projectId: string;
  messages: ChatEntry[];
  onSend: SendMessage;
  activity: AiActivity;
}

function ArchitectTab({ projectId, messages, onSend, activity }: ArchitectTabProps) {
  const { userId } = useAuth();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  // Read when the run ends, so the final message can reuse the agent's own summary.
  const latestStatus = useRef(activity.latest);
  // onComplete can fire again when the subscription stops; one final message per run.
  const finishedRunId = useRef<string | null>(null);
  // This browser's run, or one started by someone else in the room (seen through AI presence).
  const isRunActive = activeRun !== null || activity.active;
  const isBusy = isSending || isRunActive;

  useEffect(() => {
    latestStatus.current = activity.latest;
  }, [activity.latest]);

  useRealtimeRun<typeof designAgent>(activeRun?.runId, {
    accessToken: activeRun?.publicToken,
    enabled: activeRun !== null,
    skipColumns: ["payload"],
    onComplete: (run, err) => {
      const message = designRunMessage(run, err, latestStatus.current);
      if (!message) return;
      if (run && finishedRunId.current === run.id) return;
      if (run) finishedRunId.current = run.id;
      // Everyone in the room sees the outcome in ai-chat; the canvas already updated through Liveblocks.
      void onSend(message, "assistant").catch((sendErr: unknown) => console.error(sendErr));
      setActiveRun(null);
    },
  });

  useEffect(() => {
    // Scroll only the chat viewport; scrollIntoView would also shift the overflow-hidden aside.
    const viewport = endRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // Posts the prompt to ai-chat, then starts a design run and follows it in real time.
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isBusy) return;
    setIsSending(true);
    setSendError(null);
    try {
      await onSend(prompt);
    } catch (err) {
      // The chat itself is unreachable, so this error can't go into it.
      console.error(err);
      setSendError("Couldn't send your message. Try again.");
      setIsSending(false);
      return;
    }
    setDraft("");

    let runId: string;
    try {
      // POST /api/ai/design also needs projectId; here the room ID is the project ID.
      ({ runId } = await postJson<{ runId: string }>("/api/ai/design", {
        prompt,
        roomId: projectId,
        projectId,
      }));
    } catch (err) {
      console.error(err);
      await onSend("Couldn't start the design. Try again.", "assistant").catch(console.error);
      setIsSending(false);
      return;
    }
    try {
      // The design route returns only the run ID; its token route issues the run-scoped token.
      const { token } = await postJson<{ token: string }>("/api/ai/design/token", { runId });
      setActiveRun({ runId, publicToken: token });
    } catch (err) {
      console.error(err);
      await onSend(
        "The design started, but its progress can't be tracked here. Changes will still appear on the canvas.",
        "assistant"
      ).catch(console.error);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter falls through to a newline; IME composition keeps its Enter.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  }

  function pickStarter(prompt: string) {
    setDraft(prompt);
    inputRef.current?.focus();
  }

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
              <Bot className="h-6 w-6 text-ai-text" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-copy-primary">Design with MindMesh</p>
              <p className="text-xs text-copy-muted">
                Describe a system and the architect will help you sketch it on the canvas.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => pickStarter(prompt)}
                  className="rounded-full bg-subtle px-3 py-1.5 text-xs text-ai-text transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-ai/60 focus-visible:outline-none"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 p-4">
            {messages.map((message) => {
              const isOwn = message.role === "user" && message.sender.id === userId;
              return (
                <li
                  key={message.id}
                  className={cn("flex max-w-[85%] flex-col gap-1", isOwn ? "items-end self-end" : "items-start self-start")}
                >
                  <div className="flex items-baseline gap-2 px-1 text-xs text-copy-muted">
                    <span className="font-medium text-copy-secondary">{message.sender.name}</span>
                    <time dateTime={new Date(message.timestamp).toISOString()}>
                      {TIME_FORMAT.format(message.timestamp)}
                    </time>
                  </div>
                  <p
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      // User: green accent with dark text for contrast. AI: dark surface, light text.
                      message.role === "user"
                        ? "bg-accent-green text-(color:--bg-base)"
                        : "border border-surface-border bg-elevated text-copy-primary"
                    )}
                  >
                    {message.content}
                  </p>
                </li>
              );
            })}
            <li ref={endRef} aria-hidden />
          </ul>
        )}
      </ScrollArea>

      {isRunActive && <StatusStrip latest={activity.latest} />}
      {sendError && (
        <p role="alert" className="border-t border-surface-border px-3 pt-2 text-xs text-error">
          {sendError}
        </p>
      )}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-surface-border p-3">
        {/* field-sizing-content (from the shadcn Textarea) grows it between the min and max.
            Disabled, not cleared, while a run is active, so a draft survives the wait. */}
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunActive}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder={isRunActive ? "MindMesh is working…" : "Ask the AI architect…"}
          aria-label="Message the AI architect"
          className="max-h-40 min-h-18 resize-none overflow-y-auto rounded-xl bg-elevated text-copy-primary placeholder:text-copy-faint dark:bg-elevated"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || isBusy}
          aria-label={isBusy ? "MindMesh is working" : "Send message"}
          aria-busy={isBusy}
          className="rounded-xl bg-accent-green text-(color:--bg-base) hover:bg-accent-green/90"
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </>
  );
}
