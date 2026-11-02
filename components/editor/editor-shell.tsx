"use client";

import { useState, type ReactNode } from "react";

import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogsContext, useProjectDialogs } from "@/hooks/use-project-dialogs";

interface EditorShellProps {
  children: ReactNode;
}

export function EditorShell({ children }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const dialogs = useProjectDialogs();

  return (
    <ProjectDialogsContext value={dialogs}>
      <div className="flex h-screen flex-col bg-base">
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <main className="relative flex-1 overflow-hidden">{children}</main>
        <ProjectSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          projects={dialogs.projects}
          onCreate={dialogs.openCreate}
          onRename={dialogs.openRename}
          onDelete={dialogs.openDelete}
        />
      </div>
      <ProjectDialogs />
    </ProjectDialogsContext>
  );
}
