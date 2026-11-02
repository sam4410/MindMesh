import { useParams, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

import type { ProjectSummary } from "@/lib/projects";
import { toSlug } from "@/lib/slug";

type DialogState =
  | { type: "create"; suffix: string }
  | { type: "rename"; projectId: string; currentName: string }
  | { type: "delete"; project: ProjectSummary };

function shortSuffix() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

async function send(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data: { error?: string } | null = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
}

export function useProjectActions() {
  const router = useRouter();
  const { projectId: activeProjectId } = useParams<{ projectId?: string }>();
  // Kept after close so dialog content doesn't vanish mid exit-animation.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: DialogState, initialName = "") {
    setDialog(next);
    setName(initialName);
    setError(null);
    setIsOpen(true);
  }

  const trimmedName = name.trim();
  // The room ID doubles as the project ID so the project and its Liveblocks room stay aligned.
  const roomId =
    dialog?.type === "create" ? `${toSlug(name) || "untitled-project"}-${dialog.suffix}` : "";
  const canSubmit =
    !isLoading &&
    dialog !== null &&
    (dialog.type !== "rename" || (trimmedName !== "" && trimmedName !== dialog.currentName));

  async function submit() {
    if (!canSubmit || !dialog) return;
    setIsLoading(true);
    setError(null);
    try {
      if (dialog.type === "create") {
        // A blank name is omitted so the API applies its "Untitled Project" default.
        await send("/api/projects", "POST", { id: roomId, name: trimmedName || undefined });
        setIsOpen(false);
        router.push(`/editor/${roomId}`);
        router.refresh();
      } else if (dialog.type === "rename") {
        await send(`/api/projects/${encodeURIComponent(dialog.projectId)}`, "PATCH", {
          name: trimmedName,
        });
        setIsOpen(false);
        router.refresh();
      } else {
        await send(`/api/projects/${encodeURIComponent(dialog.project.id)}`, "DELETE");
        setIsOpen(false);
        if (dialog.project.id === activeProjectId) router.push("/editor");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return {
    dialog,
    isOpen,
    name,
    setName,
    roomId,
    isLoading,
    error,
    canSubmit,
    submit,
    close: () => setIsOpen(false),
    openCreate: () => open({ type: "create", suffix: shortSuffix() }),
    openRename: (project: ProjectSummary) =>
      open({ type: "rename", projectId: project.id, currentName: project.name }, project.name),
    openDelete: (project: ProjectSummary) => open({ type: "delete", project }),
  };
}

export type ProjectActions = ReturnType<typeof useProjectActions>;

export const ProjectActionsContext = createContext<ProjectActions | null>(null);

export function useProjectActionsContext() {
  const value = useContext(ProjectActionsContext);
  if (!value) throw new Error("useProjectActionsContext must be used inside EditorShell");
  return value;
}
