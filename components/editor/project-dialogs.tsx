"use client";

import { ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";

import { DesignContextFields } from "@/components/editor/design-context-fields";
import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectActionsContext } from "@/hooks/use-project-actions";
import { cn } from "@/lib/utils";

const FORM_ID = "project-dialog-form";

export function ProjectDialogs() {
  const {
    dialog,
    isOpen,
    name,
    setName,
    designContext,
    setDesignContext,
    roomId,
    isLoading,
    error,
    canSubmit,
    submit,
    close,
  } = useProjectActionsContext();
  const [showContext, setShowContext] = useState(false);

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

  // Collapsed by default to keep the dialog compact; the context is optional.
  const contextSection = (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowContext((shown) => !shown)}
        aria-expanded={showContext}
        aria-controls="create-design-context"
        className="flex items-center gap-1.5 rounded-md text-sm text-copy-secondary outline-none hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", showContext && "rotate-90")} />
        Add design context (optional)
      </button>
      {showContext && (
        <div id="create-design-context">
          <DesignContextFields
            idPrefix="create-context"
            value={designContext}
            onChange={setDesignContext}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );

  const config =
    dialog.type === "create"
      ? {
          title: "New project",
          description: "Name your new architecture workspace.",
          body: (
            <>
              {nameField}
              {contextSection}
            </>
          ),
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
            title: dialog.project.deletionPending ? "Retry project deletion" : "Delete project",
            description: dialog.project.deletionPending
              ? `Deletion of "${dialog.project.name}" was interrupted. Retry to clean up its canvas and finish deleting it.`
              : `"${dialog.project.name}" will be permanently deleted. This can't be undone.`,
            body: null,
            action: (
              <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
                {isLoading
                  ? dialog.project.deletionPending
                    ? "Retrying…"
                    : "Deleting…"
                  : dialog.project.deletionPending
                    ? "Retry deletion"
                    : "Delete project"}
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
