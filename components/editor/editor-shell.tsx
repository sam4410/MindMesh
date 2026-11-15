"use client";

import { useParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { AiSidebar } from "@/components/editor/ai-sidebar";
import { DesignContextDialog } from "@/components/editor/design-context-dialog";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ShareDialog } from "@/components/editor/share-dialog";
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import { AiChatContext, type ChatEntry, type SendChatMessage } from "@/hooks/use-ai-chat";
import { AiActivityContext, NO_AI_ACTIVITY, type AiActivity } from "@/hooks/use-ai-status";
import { CanvasSaveContext, type CanvasSaveStatus } from "@/hooks/use-canvas-autosave";
import { CanvasImportContext, type ImportTemplate } from "@/hooks/use-canvas-import";
import { ProjectActionsContext, useProjectActions } from "@/hooks/use-project-actions";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { DesignContext } from "@/lib/design-context";
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
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [savedContext, setSavedContext] = useState<{ projectId: string; value: DesignContext } | null>(
    null
  );
  // Bumped on each open so the design-context dialog's draft starts from the saved value.
  const [contextOpenCount, setContextOpenCount] = useState(0);
  // Filled by the canvas once its room is connected; see hooks/use-canvas-import.ts.
  const importTemplateRef = useRef<ImportTemplate | null>(null);
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");
  // Filled by the canvas; see hooks/use-canvas-autosave.ts.
  const saveCanvasRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<CanvasSnapshot | null>(null);
  const canvasSave = useMemo(
    () => ({ setStatus: setSaveStatus, saveRef: saveCanvasRef, canvasRef }),
    []
  );
  // Filled by the canvas from the room's status feed and presence; see hooks/use-ai-status.ts.
  const [aiActivity, setAiActivity] = useState<AiActivity>(NO_AI_ACTIVITY);
  // Filled by the canvas from the room's ai-chat feed; see hooks/use-ai-chat.ts.
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const sendChatRef = useRef<SendChatMessage | null>(null);
  const aiChat = useMemo(() => ({ setMessages: setChatMessages, sendRef: sendChatRef }), []);
  const actions = useProjectActions();
  const { roomId } = useParams<{ roomId?: string }>();
  // Only projects the user can access are in these lists, so an unauthorized room gets no workspace chrome.
  const currentProject = [...ownedProjects, ...sharedProjects].find(
    (project) => project.id === roomId && !project.deletionPending
  );

  return (
    <ProjectActionsContext value={actions}>
    <CanvasImportContext value={importTemplateRef}>
    <CanvasSaveContext value={canvasSave}>
    <AiActivityContext value={setAiActivity}>
    <AiChatContext value={aiChat}>
      <div className="flex h-screen flex-col bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
          projectName={currentProject?.name}
          isAiSidebarOpen={isAiSidebarOpen}
          onToggleAiSidebar={() => setIsAiSidebarOpen((open) => !open)}
          onShare={() => setIsShareOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
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
          {currentProject && (
            <AiSidebar
              isOpen={isAiSidebarOpen}
              onClose={() => setIsAiSidebarOpen(false)}
              activity={aiActivity}
              chatMessages={chatMessages}
              projectId={currentProject.id}
              onSendMessage={async (content, role) => {
                const send = sendChatRef.current;
                if (!send) throw new Error("The canvas room isn't connected");
                await send(content, role);
              }}
              getCanvas={() => canvasRef.current}
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
          value={
            savedContext?.projectId === currentProject.id
              ? savedContext.value
              : currentProject.designContext
          }
          open={isContextOpen}
          onOpenChange={setIsContextOpen}
          onSaved={(value) => setSavedContext({ projectId: currentProject.id, value })}
        />
      )}
      {currentProject && (
        <StarterTemplatesModal
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
    </CanvasImportContext>
    </ProjectActionsContext>
  );
}
