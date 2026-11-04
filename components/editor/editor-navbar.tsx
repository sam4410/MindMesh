import { UserButton } from "@clerk/nextjs";
import {
  AlertCircle,
  Check,
  LayoutTemplate,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Share2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  // Workspace-only: present when a project is open.
  projectName?: string;
  isAiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  onShare?: () => void;
  onOpenTemplates?: () => void;
  saveStatus?: CanvasSaveStatus;
  onSave?: () => void;
}

const SAVE_BUTTON = {
  idle: { label: "Save", title: "Save now", icon: <Save className="h-4 w-4" /> },
  saving: {
    label: "Saving…",
    title: "Saving your changes",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  },
  saved: { label: "Saved", title: "All changes saved", icon: <Check className="h-4 w-4 text-success" /> },
  error: {
    label: "Not saved",
    title: "Your latest changes aren't saved. Click to retry.",
    icon: <AlertCircle className="h-4 w-4 text-error" />,
  },
};

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  projectName,
  isAiSidebarOpen,
  onToggleAiSidebar,
  onShare,
  onOpenTemplates,
  saveStatus = "idle",
  onSave,
}: EditorNavbarProps) {
  const ToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const saveButton = SAVE_BUTTON[saveStatus];

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-surface-border bg-base px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isSidebarOpen}
      >
        <ToggleIcon className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        {projectName && (
          <>
            <h1 className="truncate text-sm font-medium text-copy-primary">{projectName}</h1>
            <p className="text-xs text-copy-faint">Workspace</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {projectName && (
          <>
            {/* min-w keeps the buttons beside it still as the label changes. */}
            <Button
              variant="outline"
              className="min-w-28 rounded-xl"
              onClick={onSave}
              title={saveButton.title}
            >
              {saveButton.icon}
              <span aria-live="polite">{saveButton.label}</span>
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onOpenTemplates}>
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onShare}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              variant={isAiSidebarOpen ? "default" : "outline"}
              className="rounded-xl"
              onClick={onToggleAiSidebar}
              aria-label={isAiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"}
              aria-expanded={isAiSidebarOpen}
              aria-controls="ai-sidebar"
            >
              <Sparkles className="h-4 w-4" />
              AI
            </Button>
          </>
        )}
        <UserButton />
      </div>
    </header>
  );
}
