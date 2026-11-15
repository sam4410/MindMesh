"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DesignContextFields } from "@/components/editor/design-context-fields";
import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import type { DesignContext } from "@/lib/design-context";

interface DesignContextDialogProps {
  projectId: string;
  // The saved context; the dialog edits a copy and saves it on Save.
  value: DesignContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (value: DesignContext) => void;
}

// Edits a project's design context. Mount with a key that changes on open so the draft starts from
// the saved value each time.
export function DesignContextDialog({
  projectId,
  value,
  open,
  onOpenChange,
  onSaved,
}: DesignContextDialogProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ designContext: draft }),
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      onSaved(draft);
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
      description="Describe what this project designs: its cloud, architecture style, industry, and type."
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
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </EditorDialog>
  );
}
