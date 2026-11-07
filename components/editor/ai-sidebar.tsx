"use client";

import { Bot, Download, FileText, SendHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
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
          <p className="text-xs text-copy-muted">Collaborate with Ghost AI</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close AI sidebar">
          <X />
        </Button>
      </header>

      <Tabs defaultValue="architect" className="min-h-0 flex-1 gap-0">
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
          <ArchitectTab />
        </TabsContent>
        <TabsContent value="specs" keepMounted className="flex min-h-0 flex-col">
          <SpecsTab />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ArchitectTab() {
  // shortcut: messages live in local state and get no reply; AI generation and Liveblocks sync
  // land in later features.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Scroll only the chat viewport; scrollIntoView would also shift the overflow-hidden aside.
    const viewport = endRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content }]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter falls through to a newline; IME composition keeps its Enter.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
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
              <p className="text-sm font-medium text-copy-primary">Design with Ghost AI</p>
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
            {messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                  message.role === "user"
                    ? "self-end border-2 border-brand/50 bg-accent-dim text-copy-primary"
                    : "self-start border border-surface-border bg-elevated text-ai-text"
                )}
              >
                {message.content}
              </li>
            ))}
            <li ref={endRef} aria-hidden />
          </ul>
        )}
      </ScrollArea>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-surface-border p-3">
        {/* field-sizing-content (from the shadcn Textarea) grows it between the min and max. */}
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI architect…"
          aria-label="Message the AI architect"
          className="max-h-40 min-h-18 resize-none overflow-y-auto rounded-xl bg-elevated text-copy-primary placeholder:text-copy-faint dark:bg-elevated"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="rounded-xl bg-ai text-white hover:bg-ai/90"
        >
          <SendHorizontal />
        </Button>
      </form>
    </>
  );
}

function SpecsTab() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Button className="w-full rounded-xl bg-ai text-white hover:bg-ai/90">
        <Sparkles />
        Generate Spec
      </Button>
      {/* Static demo card until spec generation exists. */}
      <article className="flex gap-3 rounded-2xl border border-surface-border bg-elevated p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-subtle">
          <FileText className="h-4 w-4 text-ai-text" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-medium text-copy-primary">System Architecture Spec</h3>
          <p className="line-clamp-3 text-xs text-copy-muted">
            Services, data stores and how they connect, from the current canvas.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled
          aria-label="Download spec"
          title="Download spec"
        >
          <Download />
        </Button>
      </article>
    </div>
  );
}
