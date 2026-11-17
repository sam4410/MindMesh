"use client";

import { useAuth } from "@clerk/nextjs";
import { Bot, Loader2, SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { SpecsTab } from "@/components/editor/specs-tab";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AiPromptDraft, ChatEntry } from "@/hooks/use-ai-chat";
import type { AiActivity } from "@/hooks/use-ai-status";
import type { DesignRun } from "@/hooks/use-design-run";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { DesignContext } from "@/lib/design-context";
import { getPromptSuggestions } from "@/lib/prompt-suggestions";
import { cn } from "@/lib/utils";
import { CHAT_MESSAGE_MAX_LENGTH, type TaskStatusMessage } from "@/types/tasks";

// Refinement chips shown above the input once the canvas has nodes.
const MAX_REFINEMENT_CHIPS = 3;
const CHIP_CLASS =
  "rounded-full bg-subtle px-3 py-1.5 text-xs text-ai-text transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-ai/60 focus-visible:outline-none";

// The spec's "accent" is the AI accent (indigo) here; the project's own `accent` utility is a
// shadcn surface color. Inactive tabs already use the muted text token; `!` beats tabs.tsx's
// dark: and hover: text/bg defaults so the active tab keeps the accent while hovered.
const TAB_TRIGGER =
  "rounded-lg data-active:border-transparent! data-active:bg-ai/15! data-active:text-ai-text!";

// Hours and minutes in the viewer's locale, e.g. "3:42 PM".
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const RESEARCH_STORAGE_KEY = "mindmesh:research";
// Trailing ")" is excluded so "Title (https://…)" source lines link cleanly.
const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

// Assistant messages are plain text; only their http(s) URLs become links (e.g. research sources).
function linkify(text: string) {
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-ai-text underline underline-offset-2 hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
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
  // The shared design send flow (hooks/use-design-run.ts), also used by the canvas's node toolbar.
  designRun: DesignRun;
  // From the node toolbar's "Ask AI…": put in the input, with the nodes it's about.
  promptDraft: AiPromptDraft | null;
  // The live canvas, or null until it has loaded; spec generation sends it.
  getCanvas: () => CanvasSnapshot | null;
  // The project's design context and whether the canvas has nodes; together they pick the prompt suggestions.
  designContext: DesignContext;
  hasNodes: boolean;
}

export function AiSidebar({
  isOpen,
  onClose,
  activity,
  chatMessages,
  projectId,
  designRun,
  promptDraft,
  getCanvas,
  designContext,
  hasNodes,
}: AiSidebarProps) {
  const [tab, setTab] = useState("architect");
  // A new draft from the node toolbar brings the architect tab forward (adjusted during render).
  const [seenDraft, setSeenDraft] = useState(promptDraft);
  if (promptDraft !== seenDraft) {
    setSeenDraft(promptDraft);
    if (promptDraft) setTab("architect");
  }
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
            messages={chatMessages}
            designRun={designRun}
            promptDraft={promptDraft}
            activity={activity}
            designContext={designContext}
            hasNodes={hasNodes}
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
  messages: ChatEntry[];
  designRun: DesignRun;
  promptDraft: AiPromptDraft | null;
  activity: AiActivity;
  designContext: DesignContext;
  hasNodes: boolean;
}

function ArchitectTab({ messages, designRun, promptDraft, activity, designContext, hasNodes }: ArchitectTabProps) {
  const { userId } = useAuth();
  const [draft, setDraft] = useState("");
  // The selected nodes a draft from the node toolbar is about; sent with that message (spec 48).
  const [focusNodeIds, setFocusNodeIds] = useState<string[] | null>(null);
  // Research best practices before designing (spec 70); off by default, remembered per browser.
  const [research, setResearch] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sendDesignPrompt, sendError, isBusy } = designRun;
  // This browser's run, or one started by someone else in the room (seen through AI presence).
  const isRunActive = designRun.activeRun !== null || activity.active;

  // A new draft from the node toolbar replaces the input (adjusted during render; focused below).
  const [seenDraft, setSeenDraft] = useState(promptDraft);
  if (promptDraft !== seenDraft) {
    setSeenDraft(promptDraft);
    if (promptDraft) {
      setDraft(promptDraft.text);
      setFocusNodeIds(promptDraft.focusNodeIds);
    }
  }
  useEffect(() => {
    const input = inputRef.current;
    if (!promptDraft || !input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [promptDraft]);

  // Read after mount: the sidebar also renders on the server, where localStorage doesn't exist.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      setResearch(localStorage.getItem(RESEARCH_STORAGE_KEY) === "true");
    } catch {
      // Storage can be blocked (private mode, disabled site data); the toggle just starts off.
    }
  }, []);

  function toggleResearch() {
    const next = !research;
    setResearch(next);
    try {
      localStorage.setItem(RESEARCH_STORAGE_KEY, String(next));
    } catch {
      // Not remembered, but this session still uses the choice.
    }
  }
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Scroll only the chat viewport; scrollIntoView would also shift the overflow-hidden aside.
    const viewport = endRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // Posts the prompt to ai-chat, then starts a design run and follows it (hooks/use-design-run.ts).
  async function send(event?: FormEvent) {
    event?.preventDefault();
    await sendDesignPrompt(draft, {
      focusNodeIds: focusNodeIds ?? undefined,
      research,
      onPosted: () => {
        setDraft("");
        setFocusNodeIds(null);
      },
    });
  }

  function updateDraft(value: string) {
    setDraft(value);
    // Clearing the input drops the node focus too, so a fresh prompt isn't tied to old nodes.
    if (!value.trim()) setFocusNodeIds(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter falls through to a newline; IME composition keeps its Enter.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  }

  // Fills the input and focuses it; the user still sends it.
  function pickSuggestion(prompt: string) {
    setDraft(prompt);
    setFocusNodeIds(null);
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
            {/* Once the canvas has nodes, the refinement chips above the input replace these. */}
            {!hasNodes && (
              <div className="flex flex-wrap justify-center gap-2">
                {getPromptSuggestions(designContext, false).map((prompt) => (
                  <button key={prompt} type="button" onClick={() => pickSuggestion(prompt)} className={CHIP_CLASS}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
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
                    {message.role === "assistant" ? linkify(message.content) : message.content}
                  </p>
                </li>
              );
            })}
            <li ref={endRef} aria-hidden />
          </ul>
        )}
      </ScrollArea>

      {isRunActive && <StatusStrip latest={activity.latest} />}
      {hasNodes && !isBusy && (
        <div role="group" aria-label="Suggested prompts" className="flex flex-wrap gap-1.5 px-3 pt-2">
          {getPromptSuggestions(designContext, true)
            .slice(0, MAX_REFINEMENT_CHIPS)
            .map((prompt) => (
              <button key={prompt} type="button" onClick={() => pickSuggestion(prompt)} className={CHIP_CLASS}>
                {prompt}
              </button>
            ))}
        </div>
      )}
      {sendError && (
        <p role="alert" className="border-t border-surface-border px-3 pt-2 text-xs text-error">
          {sendError}
        </p>
      )}
      <form onSubmit={send} className="flex flex-col gap-2 border-t border-surface-border p-3">
        <div className="flex items-end gap-2">
        {/* field-sizing-content (from the shadcn Textarea) grows it between the min and max.
            Disabled, not cleared, while a run is active, so a draft survives the wait. */}
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
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
        </div>
        <div className="flex items-start gap-2.5 px-1">
          <button
            type="button"
            role="switch"
            aria-checked={research}
            aria-labelledby="research-toggle-label"
            aria-describedby="research-toggle-help"
            onClick={toggleResearch}
            disabled={isRunActive}
            className={cn(
              "relative mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-surface-border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              research ? "bg-accent-green" : "bg-subtle"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-copy-primary shadow transition-transform",
                research ? "translate-x-3.5" : "translate-x-0.5"
              )}
            />
          </button>
          <div className="min-w-0 text-xs leading-4">
            <span id="research-toggle-label" className="font-medium text-copy-secondary">
              Research best practices
            </span>
            <p id="research-toggle-help" className="text-copy-faint">
              Checks official cloud documentation first. Adds about 30–60 seconds.
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
