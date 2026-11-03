import { Bot, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface AiSidebarProps {
  isOpen: boolean;
}

// shortcut: placeholder panel; AI chat lands in a later feature.
export function AiSidebar({ isOpen }: AiSidebarProps) {
  return (
    <aside
      id="ai-sidebar"
      aria-label="AI copilot"
      inert={!isOpen}
      className={cn(
        // Floats over the canvas at every size; the canvas never resizes. Closed, it slides
        // far enough (3rem) that the shadow doesn't peek in from the edge either.
        "fixed top-19 right-3 bottom-3 z-40 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-3xl border border-surface-border bg-surface/90 shadow-2xl backdrop-blur transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+3rem)]"
      )}
    >
      <div className="flex items-start justify-between border-b border-surface-border px-5 py-4">
        <div>
          <h2 className="text-sm font-medium text-copy-primary">AI Copilot</h2>
          <p className="text-xs text-copy-faint">Placeholder panel</p>
        </div>
        <Sparkles className="h-4 w-4 text-ai-text" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div className="flex gap-3 rounded-2xl border border-surface-border bg-elevated p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-subtle">
            <Bot className="h-4 w-4 text-ai-text" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-copy-primary">Chat surface pending</p>
            <p className="text-xs text-copy-muted">
              The toggle is wired. Messaging and generation are intentionally out of scope here.
            </p>
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-surface-border p-4">
          <p className="text-xs tracking-[0.2em] text-copy-faint uppercase">Future hooks</p>
          <p className="text-sm text-copy-muted">
            Prompt composer, run status, and architecture guidance will attach to this sidebar.
          </p>
        </div>
      </div>
    </aside>
  );
}
