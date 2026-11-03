"use client";

import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AiSidebar } from "@/components/editor/ai-sidebar";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ShareDialog } from "@/components/editor/share-dialog";
import { ProjectActionsContext, useProjectActions } from "@/hooks/use-project-actions";
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
  const actions = useProjectActions();
  const { roomId } = useParams<{ roomId?: string }>();
  // Only projects the user can access are in these lists, so an unauthorized room gets no workspace chrome.
  const currentProject = [...ownedProjects, ...sharedProjects].find((p) => p.id === roomId);

  return (
    <ProjectActionsContext value={actions}>
      <div className="flex h-screen flex-col bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
          projectName={currentProject?.name}
          isAiSidebarOpen={isAiSidebarOpen}
          onToggleAiSidebar={() => setIsAiSidebarOpen((open) => !open)}
          onShare={() => setIsShareOpen(true)}
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
          {currentProject && <AiSidebar isOpen={isAiSidebarOpen} />}
        </div>
      </div>
      {currentProject && (
        <ShareDialog
          key={currentProject.id}
          projectId={currentProject.id}
          // UI hint only; the collaborator APIs enforce ownership.
          isOwner={ownedProjects.some((p) => p.id === currentProject.id)}
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
        />
      )}
      <ProjectDialogs />
    </ProjectActionsContext>
  );
}
