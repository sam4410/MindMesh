"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AiSidebar } from "@/components/editor/ai-sidebar";
import { DesignContextDialog } from "@/components/editor/design-context-dialog";
import { EditorNavbar, type ExportAction, type ExportNotice } from "@/components/editor/editor-navbar";
import { IacDialog } from "@/components/editor/iac-dialog";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { RunPoller } from "@/components/editor/run-poller";
import { ShareDialog } from "@/components/editor/share-dialog";
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import { VersionHistoryDialog } from "@/components/editor/version-history-dialog";
import { AiChatContext, type AiPromptDraft, type ChatEntry, type SendChatMessage } from "@/hooks/use-ai-chat";
import { AiActivityContext, NO_AI_ACTIVITY, type AiActivity } from "@/hooks/use-ai-status";
import { CanvasSaveContext, type CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { CanvasExportContext, type ExportCanvasImage } from "@/hooks/use-canvas-export";
import { CanvasFocusContext, type FocusNodes } from "@/hooks/use-canvas-focus";
import { CanvasJiraContext, type OpenJiraIssues } from "@/hooks/use-canvas-jira";
import { CanvasImportContext, type ImportTemplate } from "@/hooks/use-canvas-import";
import { useDesignRun, type DesignPromptOptions } from "@/hooks/use-design-run";
import { ProjectActionsContext, useProjectActions } from "@/hooks/use-project-actions";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import { downloadText } from "@/lib/exporters/download";
import { toDrawio } from "@/lib/exporters/drawio";
import { toMermaid } from "@/lib/exporters/mermaid";
import { toSlug } from "@/lib/slug";
import { EMPTY_DESIGN_CONTEXT, type DesignContext } from "@/lib/design-context";
import type { ApprovalState, ApprovalStatus } from "@/lib/project-approval";
import { canManageProject } from "@/lib/project-roles";
import type { ProjectSummary } from "@/lib/projects";

interface EditorShellProps {
  ownedProjects: ProjectSummary[];
  sharedProjects: ProjectSummary[];
  children: ReactNode;
}

export function EditorShell({ ownedProjects, sharedProjects, children }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Bumped on each open so the history dialog reloads the list and gets a fresh default name.
  const [historyOpenCount, setHistoryOpenCount] = useState(0);
  // Bumped on each open so the template filters start from the project's context again.
  const [templatesOpenCount, setTemplatesOpenCount] = useState(0);
  const [isContextOpen, setIsContextOpen] = useState(false);
  // The infrastructure-as-code dialog (spec 67), opened from the Export menu.
  const [isIacOpen, setIsIacOpen] = useState(false);
  const [savedContext, setSavedContext] = useState<{ projectId: string; value: DesignContext } | null>(
    null
  );
  // Like savedContext: the repository link saved in this session wins until the server props refresh.
  const [savedRepository, setSavedRepository] = useState<{ projectId: string; value: string | null } | null>(null);
  // An approval change made here, shown until the refreshed server props catch up (they win once
  // their status differs from the one the change started from).
  const [savedApproval, setSavedApproval] = useState<{
    projectId: string;
    from: ApprovalStatus;
    value: ApprovalState;
  } | null>(null);
  const [isApprovalSaving, setIsApprovalSaving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const router = useRouter();
  // Bumped on each open so the design-context dialog's draft starts from the saved value.
  const [contextOpenCount, setContextOpenCount] = useState(0);
  // Filled by the canvas once its room is connected; see hooks/use-canvas-import.ts.
  const importTemplateRef = useRef<ImportTemplate | null>(null);
  // Filled by the canvas; see hooks/use-canvas-export.ts.
  const exportImageRef = useRef<ExportCanvasImage | null>(null);
  // Filled by the canvas; the Review tab focuses a finding's nodes through it (hooks/use-canvas-focus.ts).
  const focusNodesRef = useRef<FocusNodes | null>(null);
  // Filled by the canvas; the Export menu opens "Create Jira issues" through it (hooks/use-canvas-jira.ts).
  const openJiraRef = useRef<OpenJiraIssues | null>(null);
  // Shown briefly under the Export button: an export failure, or "Copied".
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");
  // Filled by the canvas; see hooks/use-canvas-autosave.ts.
  const saveCanvasRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<CanvasSnapshot | null>(null);
  // Whether the loaded canvas has any nodes; picks the AI sidebar's prompt suggestions.
  const [canvasHasNodes, setCanvasHasNodes] = useState(false);
  // Whether the canvas has finished loading (empty or not); versions can't be saved before.
  const [canvasLoaded, setCanvasLoaded] = useState(false);
  const canvasSave = useMemo(
    () => ({
      setStatus: setSaveStatus,
      saveRef: saveCanvasRef,
      canvasRef,
      setHasNodes: setCanvasHasNodes,
      setIsLoaded: setCanvasLoaded,
    }),
    []
  );
  // Filled by the canvas from the room's status feed and presence; see hooks/use-ai-status.ts.
  const [aiActivity, setAiActivity] = useState<AiActivity>(NO_AI_ACTIVITY);
  // Filled by the canvas from the room's ai-chat feed; see hooks/use-ai-chat.ts.
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const sendChatRef = useRef<SendChatMessage | null>(null);
  // Set by the node toolbar's "Ask AI…": the sidebar puts it in its input. A new object each time.
  const [aiPromptDraft, setAiPromptDraft] = useState<AiPromptDraft | null>(null);
  // Points at the latest sendDesignPrompt, so the context value below can stay stable.
  const sendDesignRef = useRef<(prompt: string, options?: DesignPromptOptions) => Promise<void>>(async () => {});
  const aiChat = useMemo(
    () => ({
      setMessages: setChatMessages,
      sendRef: sendChatRef,
      sendDesignPrompt: (prompt: string, focusNodeIds?: string[]) => sendDesignRef.current(prompt, { focusNodeIds }),
      openAiPrompt: (draft: AiPromptDraft) => {
        setAiPromptDraft(draft);
        setIsAiSidebarOpen(true);
      },
    }),
    []
  );
  const actions = useProjectActions();
  const { roomId } = useParams<{ roomId?: string }>();
  // Only projects the user can access are in these lists, so an unauthorized room gets no workspace chrome.
  const currentProject = [...ownedProjects, ...sharedProjects].find(
    (project) => project.id === roomId && !project.deletionPending
  );
  // A context saved in this session wins over the server props until they refresh.
  const currentContext =
    savedContext && savedContext.projectId === currentProject?.id
      ? savedContext.value
      : (currentProject?.designContext ?? EMPTY_DESIGN_CONTEXT);
  const currentRepository =
    savedRepository && savedRepository.projectId === currentProject?.id
      ? savedRepository.value
      : (currentProject?.repositoryUrl ?? null);
  const sendChat: SendChatMessage = async (content, role) => {
    const send = sendChatRef.current;
    if (!send) throw new Error("The canvas room isn't connected");
    await send(content, role);
  };
  // One design flow for the AI sidebar and the canvas's node toolbar.
  const designRun = useDesignRun({ projectId: currentProject?.id, sendChat, activity: aiActivity });
  useEffect(() => {
    sendDesignRef.current = designRun.sendDesignPrompt;
  });
  // Changes only when a send starts or a run ends, so the node toolbar can disable right away.
  const aiChatValue = useMemo(() => ({ ...aiChat, isDesignBusy: designRun.isBusy }), [aiChat, designRun.isBusy]);

  const serverApproval: ApprovalState | undefined = currentProject && {
    approvalStatus: currentProject.approvalStatus,
    approvedByName: currentProject.approvedByName,
    approvedAt: currentProject.approvedAt,
  };
  const currentApproval =
    savedApproval && currentProject && savedApproval.projectId === currentProject.id &&
    savedApproval.from === currentProject.approvalStatus
      ? savedApproval.value
      : serverApproval;

  useEffect(() => {
    if (!approvalError) return;
    const timer = setTimeout(() => setApprovalError(null), 5000);
    return () => clearTimeout(timer);
  }, [approvalError]);

  async function changeApproval(status: ApprovalStatus) {
    if (!currentProject || !currentApproval || isApprovalSaving) return;
    const projectId = currentProject.id;
    setIsApprovalSaving(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/approval`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json().catch(() => null)) as (ApprovalState & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error ?? "Couldn't change the status. Try again.");
      setSavedApproval({
        projectId,
        from: currentProject.approvalStatus,
        value: { approvalStatus: body.approvalStatus, approvedByName: body.approvedByName, approvedAt: body.approvedAt },
      });
      // The sidebar dots come from the server props.
      router.refresh();
    } catch (err) {
      setApprovalError((err as Error).message);
    } finally {
      setIsApprovalSaving(false);
    }
  }

  useEffect(() => {
    if (!exportNotice) return;
    const timer = setTimeout(() => setExportNotice(null), exportNotice.tone === "error" ? 5000 : 2000);
    return () => clearTimeout(timer);
  }, [exportNotice]);

  async function handleExport(action: ExportAction) {
    if (!currentProject) return;
    const fileBaseName = `${toSlug(currentProject.name) || "canvas"}-diagram`;
    setExportNotice(null);

    // Opens the canvas's "Create Jira issues" dialog with every component (spec 62).
    if (action === "jira") {
      openJiraRef.current?.();
      return;
    }

    if (action === "iac") {
      setIsIacOpen(true);
      return;
    }

    if (action === "png" || action === "svg") {
      const exportCanvas = exportImageRef.current;
      if (!exportCanvas) return;
      try {
        await exportCanvas(action, fileBaseName);
      } catch (err) {
        console.error(err);
        setExportNotice({ tone: "error", text: "Couldn't export the image. Try again." });
      }
      return;
    }

    // Mermaid and draw.io are built from the live canvas the autosave hook hands over (spec 51).
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (action === "drawio") {
      downloadText(toDrawio(canvas.nodes, canvas.edges), `${fileBaseName}.drawio`, "application/vnd.jgraph.mxfile");
      return;
    }
    const mermaid = toMermaid(canvas.nodes, canvas.edges);
    if (action === "mermaid") {
      downloadText(mermaid, `${fileBaseName}.mmd`, "text/plain");
      return;
    }
    try {
      await navigator.clipboard.writeText(mermaid);
      setExportNotice({ tone: "success", text: "Copied" });
    } catch (err) {
      console.error(err);
      setExportNotice({ tone: "error", text: "Couldn't copy to the clipboard. Try again." });
    }
  }

  return (
    <ProjectActionsContext value={actions}>
    <CanvasImportContext value={importTemplateRef}>
    <CanvasExportContext value={exportImageRef}>
    <CanvasFocusContext value={focusNodesRef}>
    <CanvasJiraContext value={openJiraRef}>
    <CanvasSaveContext value={canvasSave}>
    <AiActivityContext value={setAiActivity}>
    <AiChatContext value={aiChatValue}>
      <div className="flex h-screen flex-col bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
          projectName={currentProject?.name}
          isAiSidebarOpen={isAiSidebarOpen}
          onToggleAiSidebar={() => setIsAiSidebarOpen((open) => !open)}
          onShare={() => setIsShareOpen(true)}
          onOpenTemplates={() => {
            setTemplatesOpenCount((count) => count + 1);
            setIsTemplatesOpen(true);
          }}
          onExport={(action) => void handleExport(action)}
          canExport={canvasHasNodes}
          exportNotice={exportNotice}
          saveStatus={saveStatus}
          onSave={() => saveCanvasRef.current?.()}
          onOpenHistory={() => {
            setHistoryOpenCount((count) => count + 1);
            setIsHistoryOpen(true);
          }}
          designContext={currentProject?.designContext}
          repositoryUrl={currentRepository}
          approval={currentApproval}
          approvalRole={currentProject?.role}
          onChangeApproval={(status) => void changeApproval(status)}
          isApprovalSaving={isApprovalSaving}
          approvalError={approvalError}
          onEditDesignContext={() => {
            setContextOpenCount((count) => count + 1);
            setIsContextOpen(true);
          }}
        />
        {/* The canvas fills everything below the navbar; both sidebars float over it. */}
        <div className="relative min-h-0 flex-1">
          <ProjectSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            ownedProjects={ownedProjects}
            sharedProjects={sharedProjects}
            activeProjectId={currentProject?.id}
            onCreate={actions.openCreate}
            onRename={actions.openRename}
            onDelete={actions.openDelete}
          />
          <main className="relative h-full overflow-hidden bg-base">
            {children}
          </main>
          {/* Follows this browser's design run; see components/editor/run-poller.tsx. */}
          {designRun.activeRun && <RunPoller runId={designRun.activeRun.runId} onComplete={designRun.finishRun} />}
          {currentProject && (
            <AiSidebar
              isOpen={isAiSidebarOpen}
              onClose={() => setIsAiSidebarOpen(false)}
              activity={aiActivity}
              chatMessages={chatMessages}
              projectId={currentProject.id}
              designRun={designRun}
              promptDraft={aiPromptDraft}
              getCanvas={() => canvasRef.current}
              designContext={currentContext}
              hasNodes={canvasHasNodes}
              projectName={currentProject.name}
            />
          )}
        </div>
      </div>
      {currentProject && (
        <ShareDialog
          key={currentProject.id}
          projectId={currentProject.id}
          // UI hint only; the collaborator APIs enforce the role.
          canManage={canManageProject(currentProject.role)}
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
        />
      )}
      {currentProject && (
        <DesignContextDialog
          key={`${currentProject.id}-${contextOpenCount}`}
          projectId={currentProject.id}
          value={currentContext}
          repositoryUrl={currentRepository}
          // UI hint only; PATCH /api/projects/[projectId] enforces the role.
          canEditRepository={canManageProject(currentProject.role)}
          open={isContextOpen}
          onOpenChange={setIsContextOpen}
          onSaved={(value, repositoryUrl) => {
            setSavedContext({ projectId: currentProject.id, value });
            setSavedRepository({ projectId: currentProject.id, value: repositoryUrl });
          }}
        />
      )}
      {currentProject && (
        // Not keyed on open, so a running generation keeps being followed while the dialog is closed.
        <IacDialog
          key={`iac-${currentProject.id}`}
          projectId={currentProject.id}
          designContext={currentContext}
          getCanvas={() => canvasRef.current}
          open={isIacOpen}
          onOpenChange={setIsIacOpen}
        />
      )}
      {currentProject && (
        <StarterTemplatesModal
          key={`templates-${currentProject.id}-${templatesOpenCount}`}
          designContext={currentContext}
          open={isTemplatesOpen}
          onOpenChange={setIsTemplatesOpen}
          onImport={(template) => {
            const importTemplate = importTemplateRef.current;
            if (!importTemplate) return false;
            importTemplate(template);
            return true;
          }}
        />
      )}
      {currentProject && (
        <VersionHistoryDialog
          key={`history-${currentProject.id}-${historyOpenCount}`}
          projectId={currentProject.id}
          // UI hint only; the delete route enforces the role.
          canManage={canManageProject(currentProject.role)}
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          isCanvasLoaded={canvasLoaded}
          getCanvas={() => canvasRef.current}
          onRestore={(canvas) => {
            const importCanvas = importTemplateRef.current;
            if (!importCanvas) return false;
            importCanvas(canvas);
            return true;
          }}
        />
      )}
      <ProjectDialogs />
    </AiChatContext>
    </AiActivityContext>
    </CanvasSaveContext>
    </CanvasJiraContext>
    </CanvasFocusContext>
    </CanvasExportContext>
    </CanvasImportContext>
    </ProjectActionsContext>
  );
}
