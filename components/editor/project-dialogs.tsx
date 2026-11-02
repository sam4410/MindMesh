"use client";

import type { FormEvent } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectDialogsContext } from "@/hooks/use-project-dialogs";

const FORM_ID = "project-dialog-form";

export function ProjectDialogs() {
  const { dialog, isOpen, name, setName, slug, isLoading, canSubmit, submit, close } =
    useProjectDialogsContext();

  if (!dialog) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  const cancel = (
    <Button variant="ghost" onClick={close} disabled={isLoading}>
      Cancel
    </Button>
  );

  const nameField = (
    <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="project-name" className="text-sm font-medium text-copy-secondary">
        Project name
      </label>
      <Input
        id="project-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Payments Platform"
        autoComplete="off"
        autoFocus
      />
      {dialog.type === "create" && (
        <p className="text-xs text-copy-muted">
          Slug: <span className="font-mono text-copy-secondary">{slug || "—"}</span>
        </p>
      )}
    </form>
  );

  const config =
    dialog.type === "create"
      ? {
          title: "New project",
          description: "Name your new architecture workspace.",
          body: nameField,
          action: (
            <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
              Create project
            </Button>
          ),
        }
      : dialog.type === "rename"
        ? {
            title: "Rename project",
            description: `Current name: ${dialog.project.name}`,
            body: nameField,
            action: (
              <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
                Rename
              </Button>
            ),
          }
        : {
            title: "Delete project",
            description: `"${dialog.project.name}" will be permanently deleted. This can't be undone.`,
            body: null,
            action: (
              <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
                Delete project
              </Button>
            ),
          };

  return (
    <EditorDialog
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      title={config.title}
      description={config.description}
      footer={
        <>
          {cancel}
          {config.action}
        </>
      }
    >
      {config.body}
    </EditorDialog>
  );
}
