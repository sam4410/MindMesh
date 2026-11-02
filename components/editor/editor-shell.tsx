"use client";

import { useState, type ReactNode } from "react";

import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectActionsContext, useProjectActions } from "@/hooks/use-project-actions";
import type { ProjectSummary } from "@/lib/projects";

interface EditorShellProps {
  ownedProjects: ProjectSummary[];
  sharedProjects: ProjectSummary[];
  children: ReactNode;
}

export function EditorShell({ ownedProjects, sharedProjects, children }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const actions = useProjectActions();

  return (
    <ProjectActionsContext value={actions}>
      <div className="flex h-screen flex-col bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <main className="relative flex-1 overflow-hidden">{children}</main>
        <ProjectSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
          onCreate={actions.openCreate}
          onRename={actions.openRename}
          onDelete={actions.openDelete}
        />
      </div>
      <ProjectDialogs />
    </ProjectActionsContext>
  );
}
