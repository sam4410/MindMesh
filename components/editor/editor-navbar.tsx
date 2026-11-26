import { UserButton } from "@clerk/nextjs";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileCode,
  FileImage,
  History,
  LayoutTemplate,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Save,
  Share2,
  Sparkles,
  Ticket,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { designContextLabels, type DesignContext } from "@/lib/design-context";
import type { ImageFormat } from "@/lib/export-image";
import { allowedApprovalChanges, type ApprovalState, type ApprovalStatus } from "@/lib/project-approval";
import type { ProjectRole } from "@/lib/project-roles";
import { cn } from "@/lib/utils";

// Export menu items: images (spec 50), Mermaid and draw.io text (spec 51), then Jira issues (spec 62).
export type ExportAction = ImageFormat | "mermaid" | "drawio" | "copy-mermaid" | "jira";

// Shown briefly under the Export button: a failure, or "Copied".
export interface ExportNotice {
  tone: "error" | "success";
  text: string;
}

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  // Workspace-only: present when a project is open.
  projectName?: string;
  isAiSidebarOpen?: boolean;
  onToggleAiSidebar?: () => void;
  onShare?: () => void;
  onOpenTemplates?: () => void;
  onExport?: (action: ExportAction) => void;
  // False on an empty (or still loading) canvas, which disables the export items.
  canExport?: boolean;
  exportNotice?: ExportNotice | null;
  saveStatus?: CanvasSaveStatus;
  onSave?: () => void;
  onOpenHistory?: () => void;
  designContext?: DesignContext;
  onEditDesignContext?: () => void;
  // Approval status (spec 57): the current state, the user's role (which picks the changes on
  // offer; the route enforces it), and errors.
  approval?: ApprovalState;
  approvalRole?: ProjectRole;
  onChangeApproval?: (status: ApprovalStatus) => void;
  isApprovalSaving?: boolean;
  approvalError?: string | null;
}

const APPROVAL_STYLES: Record<ApprovalStatus, { label: string; className: string; dot: string }> = {
  DRAFT: { label: "Draft", className: "border-surface-border text-copy-muted", dot: "bg-copy-faint" },
  IN_REVIEW: { label: "In review", className: "border-warning/40 bg-warning/10 text-warning", dot: "bg-warning" },
  APPROVED: { label: "Approved", className: "border-success/40 bg-success/10 text-success", dot: "bg-success" },
};

// Menu wording for each allowed change, keyed "FROM>TO".
const APPROVAL_CHANGE_LABELS: Record<string, string> = {
  "DRAFT>IN_REVIEW": "Send for review",
  "IN_REVIEW>DRAFT": "Back to draft",
  "IN_REVIEW>APPROVED": "Approve",
  "APPROVED>DRAFT": "Reopen as draft",
};

const APPROVAL_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

// "Draft", "In review", or "Approved by {name} · {date}".
function approvalLabel({ approvalStatus, approvedByName, approvedAt }: ApprovalState) {
  if (approvalStatus !== "APPROVED") return APPROVAL_STYLES[approvalStatus].label;
  const parts = [`Approved by ${approvedByName ?? "someone"}`];
  if (approvedAt) parts.push(APPROVAL_DATE_FORMAT.format(new Date(approvedAt)));
  return parts.join(" · ");
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
  onExport,
  canExport = false,
  exportNotice,
  saveStatus = "idle",
  onSave,
  onOpenHistory,
  designContext,
  onEditDesignContext,
  approval,
  approvalRole,
  onChangeApproval,
  isApprovalSaving = false,
  approvalError,
}: EditorNavbarProps) {
  const ToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const contextLabels = designContext ? designContextLabels(designContext) : [];
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
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-medium text-copy-primary">{projectName}</h1>
              {approval && approvalRole && (
                <ApprovalPill
                  approval={approval}
                  changes={allowedApprovalChanges(approval.approvalStatus, approvalRole)}
                  onChange={onChangeApproval}
                  isSaving={isApprovalSaving}
                  error={approvalError}
                />
              )}
            </div>
            {/* The design context as chips; opens the edit dialog. */}
            <button
              type="button"
              onClick={onEditDesignContext}
              aria-label={contextLabels.length > 0 ? `Design context: ${contextLabels.join(", ")}. Edit` : "Add design context"}
              className="mt-0.5 flex max-w-full items-center gap-1 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contextLabels.length > 0 ? (
                contextLabels.map((label) => (
                  <span
                    key={label}
                    className="shrink-0 rounded-full border border-surface-border bg-subtle px-2 py-px text-[11px] leading-4 text-copy-muted hover:text-copy-secondary"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-copy-faint hover:text-copy-secondary">Add design context</span>
              )}
            </button>
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
            <Button variant="outline" className="rounded-xl" onClick={onOpenHistory}>
              <History className="h-4 w-4" />
              History
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onOpenTemplates} data-tour="templates">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </Button>
            {/* Later specs add more export items to this menu. */}
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" className="rounded-xl" />}>
                  <Download className="h-4 w-4" />
                  Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto min-w-40">
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("png")}>
                    <FileImage />
                    PNG image
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("svg")}>
                    <FileImage />
                    {/* Browser-only: html-to-image SVGs hold HTML in a foreignObject, which slide
                        and design apps don't draw. A vector SVG export is in the tracker's backlog. */}
                    SVG (web)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("mermaid")}>
                    <FileCode />
                    Mermaid (.mmd)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("drawio")}>
                    <FileCode />
                    draw.io (.drawio)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("copy-mermaid")}>
                    <Copy />
                    Copy Mermaid
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!canExport} onClick={() => onExport?.("jira")}>
                    <Ticket />
                    Create Jira issues
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {exportNotice && (
                <p
                  role={exportNotice.tone === "error" ? "alert" : "status"}
                  className={`absolute top-full right-0 z-50 mt-2 flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-lg ${
                    exportNotice.tone === "error" ? "text-error" : "text-success"
                  }`}
                >
                  {exportNotice.tone === "success" && <Check aria-hidden className="h-3.5 w-3.5" />}
                  {exportNotice.text}
                </p>
              )}
            </div>
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
              data-tour="ai"
            >
              <Sparkles className="h-4 w-4" />
              AI
            </Button>
          </>
        )}
        {/* In the workspace it sits in the canvas's presence panel instead. */}
        {!projectName && (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link label="Integrations" labelIcon={<Plug className="h-4 w-4" />} href="/settings/integrations" />
            </UserButton.MenuItems>
          </UserButton>
        )}
      </div>
    </header>
  );
}

interface ApprovalPillProps {
  approval: ApprovalState;
  changes: ApprovalStatus[];
  onChange?: (status: ApprovalStatus) => void;
  isSaving: boolean;
  error?: string | null;
}

// The project's approval status; opens a menu with the changes this user's role allows.
function ApprovalPill({ approval, changes, onChange, isSaving, error }: ApprovalPillProps) {
  const style = APPROVAL_STYLES[approval.approvalStatus];
  const label = approvalLabel(approval);
  const pillClass = cn(
    "flex max-w-64 shrink-0 items-center gap-1.5 rounded-full border px-2 py-px text-[11px] leading-4 outline-none",
    style.className
  );
  const content = (
    <>
      {isSaving ? (
        <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
      )}
      <span className="truncate">{label}</span>
    </>
  );

  return (
    <div className="relative">
      {changes.length === 0 ? (
        // Nothing this role can change (an approved project for a member or collaborator).
        <span className={pillClass} title="Only the owner or an admin can change this">
          {content}
        </span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isSaving}
            aria-label={`Approval status: ${label}. Change`}
            render={<button type="button" className={cn(pillClass, "focus-visible:ring-2 focus-visible:ring-ring")} />}
          >
            {content}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto min-w-40">
            {changes.map((to) => (
              <DropdownMenuItem key={to} onClick={() => onChange?.(to)}>
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", APPROVAL_STYLES[to].dot)} />
                {APPROVAL_CHANGE_LABELS[`${approval.approvalStatus}>${to}`] ?? APPROVAL_STYLES[to].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {error && (
        <p
          role="alert"
          className="absolute top-full left-0 z-50 mt-2 rounded-md border border-surface-border bg-surface px-2 py-1 text-xs whitespace-nowrap text-error shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  );
}
