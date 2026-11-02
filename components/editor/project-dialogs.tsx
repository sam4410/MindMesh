"use client";

import type { FormEvent } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectActionsContext } from "@/hooks/use-project-actions";

const FORM_ID = "project-dialog-form";

export function ProjectDialogs() {
  const { dialog, isOpen, name, setName, roomId, isLoading, error, canSubmit, submit, close } =
    useProjectActionsContext();

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
        placeholder={dialog.type === "create" ? "Untitled Project" : undefined}
        autoComplete="off"
        autoFocus
      />
      {dialog.type === "create" && (
        <p className="text-xs text-copy-muted">
          Room ID: <span className="font-mono break-all text-copy-secondary">{roomId}</span>
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
              {isLoading ? "Creating…" : "Create project"}
            </Button>
          ),
        }
      : dialog.type === "rename"
        ? {
            title: "Rename project",
            description: `Current name: ${dialog.currentName}`,
            body: nameField,
            action: (
              <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
                {isLoading ? "Renaming…" : "Rename"}
              </Button>
            ),
          }
        : {
            title: "Delete project",
            description: `"${dialog.project.name}" will be permanently deleted. This can't be undone.`,
            body: null,
            action: (
              <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
                {isLoading ? "Deleting…" : "Delete project"}
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
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </EditorDialog>
  );
}
