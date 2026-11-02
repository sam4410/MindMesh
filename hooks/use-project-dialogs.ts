import { createContext, useContext, useState } from "react";

import { mockProjects, toSlug, type Project } from "@/lib/projects";

type DialogState =
  | { type: "create" }
  | { type: "rename"; project: Project }
  | { type: "delete"; project: Project };

export function useProjectDialogs() {
  const [projects, setProjects] = useState(mockProjects);
  // Kept after close so dialog content doesn't vanish mid exit-animation.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function open(next: DialogState, initialName = "") {
    setDialog(next);
    setName(initialName);
    setIsOpen(true);
  }

  const trimmedName = name.trim();
  const slug = toSlug(name);
  const canSubmit =
    !isLoading &&
    (dialog?.type === "create"
      ? slug !== ""
      : dialog?.type === "rename"
        ? trimmedName !== "" && trimmedName !== dialog.project.name
        : dialog !== null);

  function submit() {
    if (!canSubmit || !dialog) return;
    setIsLoading(true);
    // shortcut: local state only; swap for API calls when persistence lands.
    if (dialog.type === "create") {
      setProjects((list) => [
        { id: crypto.randomUUID(), name: trimmedName, slug, isOwner: true },
        ...list,
      ]);
    } else if (dialog.type === "rename") {
      setProjects((list) =>
        list.map((p) => (p.id === dialog.project.id ? { ...p, name: trimmedName } : p))
      );
    } else {
      setProjects((list) => list.filter((p) => p.id !== dialog.project.id));
    }
    setIsLoading(false);
    setIsOpen(false);
  }

  return {
    projects,
    dialog,
    isOpen,
    name,
    setName,
    slug,
    isLoading,
    canSubmit,
    submit,
    close: () => setIsOpen(false),
    openCreate: () => open({ type: "create" }),
    openRename: (project: Project) => open({ type: "rename", project }, project.name),
    openDelete: (project: Project) => open({ type: "delete", project }),
  };
}

export type ProjectDialogs = ReturnType<typeof useProjectDialogs>;

export const ProjectDialogsContext = createContext<ProjectDialogs | null>(null);

export function useProjectDialogsContext() {
  const value = useContext(ProjectDialogsContext);
  if (!value) throw new Error("useProjectDialogsContext must be used inside EditorShell");
  return value;
}
