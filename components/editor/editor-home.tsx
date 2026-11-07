"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProjectActionsContext } from "@/hooks/use-project-actions";

export function EditorHome() {
  const { openCreate } = useProjectActionsContext();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
        Create a project or open an existing one
      </h1>
      <p className="max-w-md text-sm text-copy-muted">
        Start a new architecture workspace, or choose a project from the sidebar.
      </p>
      <Button size="lg" className="mt-2 rounded-xl" onClick={openCreate}>
        <Plus className="h-5 w-5" />
        New Project
      </Button>
    </div>
  );
}
