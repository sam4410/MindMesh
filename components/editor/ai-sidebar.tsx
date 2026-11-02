import { Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// shortcut: placeholder panel; AI chat lands in a later feature.
export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
  return (
    <aside
      id="ai-sidebar"
      aria-label="AI assistant"
      inert={!isOpen}
      className={cn(
        "fixed top-16 right-2 bottom-2 z-40 flex w-80 max-w-[calc(100vw-1rem)] flex-col rounded-2xl border border-surface-border bg-surface/90 backdrop-blur transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+0.5rem)]"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-copy-primary">
          <Sparkles className="h-4 w-4 text-ai-text" />
          AI Assistant
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close AI sidebar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="h-8 w-8 text-copy-faint" />
        <p className="text-sm text-copy-muted">AI chat is coming soon.</p>
      </div>
    </aside>
  );
}
