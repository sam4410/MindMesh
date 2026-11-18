"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AiSidebar } from "@/components/editor/ai-sidebar";
import { DesignContextDialog } from "@/components/editor/design-context-dialog";
import { EditorNavbar, type ExportAction, type ExportNotice } from "@/components/editor/editor-navbar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { RunPoller } from "@/components/editor/run-poller";
import { ShareDialog } from "@/components/editor/share-dialog";
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import { AiChatContext, type AiPromptDraft, type ChatEntry, type SendChatMessage } from "@/hooks/use-ai-chat";
import { AiActivityContext, NO_AI_ACTIVITY, type AiActivity } from "@/hooks/use-ai-status";
import { CanvasSaveContext, type CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { CanvasExportContext, type ExportCanvasImage } from "@/hooks/use-canvas-export";
import { CanvasFocusContext, type FocusNodes } from "@/hooks/use-canvas-focus";
import { CanvasImportContext, type ImportTemplate } from "@/hooks/use-canvas-import";
import { useDesignRun, type DesignPromptOptions } from "@/hooks/use-design-run";
import { ProjectActionsContext, useProjectActions } from "@/hooks/use-project-actions";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import { downloadText } from "@/lib/exporters/download";
import { toDrawio } from "@/lib/exporters/drawio";
import { toMermaid } from "@/lib/exporters/mermaid";
import { toSlug } from "@/lib/slug";
import { EMPTY_DESIGN_CONTEXT, type DesignContext } from "@/lib/design-context";
import { canManageProject } from "@/lib/project-roles";
import type { ProjectSummary } from "@/lib/projects";
import type { designAgent } from "@/trigger/design-agent";

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
  // Bumped on each open so the template filters start from the project's context again.
  const [templatesOpenCount, setTemplatesOpenCount] = useState(0);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [savedContext, setSavedContext] = useState<{ projectId: string; value: DesignContext } | null>(
    null
  );
  // Bumped on each open so the design-context dialog's draft starts from the saved value.
  const [contextOpenCount, setContextOpenCount] = useState(0);
  // Filled by the canvas once its room is connected; see hooks/use-canvas-import.ts.
  const importTemplateRef = useRef<ImportTemplate | null>(null);
  // Filled by the canvas; see hooks/use-canvas-export.ts.
  const exportImageRef = useRef<ExportCanvasImage | null>(null);
  // Filled by the canvas; the Review tab focuses a finding's nodes through it (hooks/use-canvas-focus.ts).
  const focusNodesRef = useRef<FocusNodes | null>(null);
  // Shown briefly under the Export button: an export failure, or "Copied".
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");
  // Filled by the canvas; see hooks/use-canvas-autosave.ts.
  const saveCanvasRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<CanvasSnapshot | null>(null);
  // Whether the loaded canvas has any nodes; picks the AI sidebar's prompt suggestions.
  const [canvasHasNodes, setCanvasHasNodes] = useState(false);
  const canvasSave = useMemo(
    () => ({ setStatus: setSaveStatus, saveRef: saveCanvasRef, canvasRef, setHasNodes: setCanvasHasNodes }),
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

  useEffect(() => {
    if (!exportNotice) return;
    const timer = setTimeout(() => setExportNotice(null), exportNotice.tone === "error" ? 5000 : 2000);
    return () => clearTimeout(timer);
  }, [exportNotice]);

  async function handleExport(action: ExportAction) {
    if (!currentProject) return;
    const fileBaseName = `${toSlug(currentProject.name) || "canvas"}-diagram`;
    setExportNotice(null);

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
          designContext={currentProject?.designContext}
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
          {/* Polling fallback for this browser's design run; see components/editor/run-poller.tsx. */}
          {designRun.activeRun && (
            <RunPoller<typeof designAgent>
              runId={designRun.activeRun.runId}
              accessToken={designRun.activeRun.publicToken}
              onComplete={designRun.finishRun}
            />
          )}
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
          open={isContextOpen}
          onOpenChange={setIsContextOpen}
          onSaved={(value) => setSavedContext({ projectId: currentProject.id, value })}
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
      <ProjectDialogs />
    </AiChatContext>
    </AiActivityContext>
    </CanvasSaveContext>
    </CanvasFocusContext>
    </CanvasExportContext>
    </CanvasImportContext>
    </ProjectActionsContext>
  );
}
