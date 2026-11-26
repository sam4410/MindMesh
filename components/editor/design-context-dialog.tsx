"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DesignContextFields } from "@/components/editor/design-context-fields";
import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DesignContext } from "@/lib/design-context";

interface DesignContextDialogProps {
  projectId: string;
  // The saved context; the dialog edits a copy and saves it on Save.
  value: DesignContext;
  // The saved GitHub link (spec 63); only owners and admins can change it (the API enforces this).
  repositoryUrl: string | null;
  canEditRepository: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (value: DesignContext, repositoryUrl: string | null) => void;
}

// Edits a project's design context. Mount with a key that changes on open so the draft starts from
// the saved value each time.
export function DesignContextDialog({
  projectId,
  value,
  repositoryUrl,
  canEditRepository,
  open,
  onOpenChange,
  onSaved,
}: DesignContextDialogProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [repositoryDraft, setRepositoryDraft] = useState(repositoryUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // Sent only by owners and admins; a blank field clears the link.
        body: JSON.stringify({
          designContext: draft,
          ...(canEditRepository && { repositoryUrl: repositoryDraft.trim() || null }),
        }),
      });
      const data: { error?: string; repositoryUrl?: string | null } | null = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      // The server's normalized URL (e.g. without ".git").
      onSaved(draft, data?.repositoryUrl ?? null);
      onOpenChange(false);
      // Collaborators see the change after they reload; this refreshes the current user's view.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the design context");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditorDialog
      open={open}
      onOpenChange={(next) => !isSaving && onOpenChange(next)}
      title="Design context"
      description="Describe what this project designs: its cloud, architecture style, industry, type, and repository."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <DesignContextFields idPrefix="edit-context" value={draft} onChange={setDraft} disabled={isSaving} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-context-repository" className="text-xs font-medium text-copy-secondary">
          Repository
        </label>
        <Input
          id="edit-context-repository"
          type="url"
          inputMode="url"
          value={repositoryDraft}
          onChange={(event) => setRepositoryDraft(event.target.value)}
          placeholder="https://github.com/owner/repo"
          autoComplete="off"
          disabled={isSaving || !canEditRepository}
          aria-describedby="edit-context-repository-hint"
          className="rounded-xl"
        />
        <p id="edit-context-repository-hint" className="text-xs text-copy-muted">
          {canEditRepository
            ? "A GitHub repository. New specs and decision records link to it."
            : "Only the project owner or an admin can change the repository."}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </EditorDialog>
  );
}
