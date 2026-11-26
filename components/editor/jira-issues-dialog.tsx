"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// POST /api/projects/[projectId]/jira/issues takes at most this many components.
const MAX_COMPONENTS = 25;

export interface JiraComponent {
  nodeId: string;
  label: string;
  service?: string;
  incoming: string[];
  outgoing: string[];
  // Already linked to an issue: left unchecked by default.
  existingKey?: string;
}

interface IssueResults {
  created: { nodeId: string; key: string; url: string }[];
  failed: { nodeId: string; error: string }[];
}

// The canvas's components (boundaries are zones, not components) with their connections in the
// form the descriptions use: "Order Intake → Order Queue: Publish Order". `onlyIds` limits the
// list to a selection; connections still name the nodes at the other end.
export function jiraComponents(nodes: CanvasNode[], edges: CanvasEdge[], onlyIds?: string[]): JiraComponent[] {
  const wanted = onlyIds && new Set(onlyIds);
  const nameOf = (node: CanvasNode | undefined) =>
    node ? node.data.label.replace(/\s+/g, " ").trim() || `unlabeled ${node.data.shape}` : "unknown";
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const describe = (edge: CanvasEdge) => {
    const label = edge.data?.label?.trim();
    return `${nameOf(byId.get(edge.source))} → ${nameOf(byId.get(edge.target))}${label ? `: ${label}` : ""}`;
  };
  return nodes
    .filter((node) => node.data.shape !== "boundary" && (!wanted || wanted.has(node.id)))
    .map((node) => ({
      nodeId: node.id,
      label: nameOf(node),
      ...(node.data.service ? { service: node.data.service } : {}),
      incoming: edges.filter((edge) => edge.target === node.id).map(describe),
      outgoing: edges.filter((edge) => edge.source === node.id).map(describe),
      ...(node.data.jiraIssue ? { existingKey: node.data.jiraIssue.key } : {}),
    }));
}

interface JiraIssuesDialogProps {
  projectId: string;
  components: JiraComponent[];
  // Writes each created issue into its node, so every collaborator sees the badge.
  onCreated: (created: IssueResults["created"]) => void;
  onClose: () => void;
}

export function JiraIssuesDialog({ projectId, components, onCreated, onClose }: JiraIssuesDialogProps) {
  const [projectKey, setProjectKey] = useState("");
  const [issueType, setIssueType] = useState("Task");
  const [checked, setChecked] = useState(() => new Set(components.filter((c) => !c.existingKey).map((c) => c.nodeId)));
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<{ text: string; needsConnection: boolean } | null>(null);
  const [results, setResults] = useState<IssueResults | null>(null);

  const labelOf = new Map(components.map((component) => [component.nodeId, component.label]));
  const tooMany = checked.size > MAX_COMPONENTS;
  const canSubmit = !isCreating && projectKey.trim() !== "" && issueType.trim() !== "" && checked.size > 0 && !tooMany;

  function toggle(nodeId: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/jira/issues`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jiraProjectKey: projectKey.trim(),
          issueType: issueType.trim(),
          components: components
            .filter((component) => checked.has(component.nodeId))
            .map(({ nodeId, label, service, incoming, outgoing }) => ({ nodeId, label, service, incoming, outgoing })),
        }),
      });
      const body = (await res.json().catch(() => null)) as (IssueResults & { error?: string }) | null;
      if (!res.ok || !body?.created) {
        setError({
          text: body?.error ?? "Couldn't create the issues. Try again.",
          needsConnection: res.status === 404 && body?.error === "Connect Atlassian first",
        });
        return;
      }
      if (body.created.length > 0) onCreated(body.created);
      setResults(body);
    } catch {
      setError({ text: "Couldn't create the issues. Try again.", needsConnection: false });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => {
        if (!open && !isCreating) onClose();
      }}
      title="Create Jira issues"
      description="One issue per component, with its connections in the description."
      className="sm:max-w-lg"
      footer={
        results ? (
          <Button className="rounded-xl" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" form="jira-issues-form" className="rounded-xl" disabled={!canSubmit}>
              {isCreating && <Loader2 className="animate-spin" />}
              {isCreating
                ? "Creating…"
                : `Create ${checked.size} ${checked.size === 1 ? "issue" : "issues"}`}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <div className="flex flex-col gap-4 text-sm" role="status">
          {results.created.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-copy-primary">Created {results.created.length}</h3>
              <ul className="flex flex-col gap-1.5">
                {results.created.map(({ nodeId, key, url }) => (
                  <li key={nodeId} className="flex items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline"
                    >
                      {key}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="truncate text-copy-secondary">{labelOf.get(nodeId)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.failed.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-error">Failed {results.failed.length}</h3>
              <ul className="flex flex-col gap-1.5">
                {results.failed.map(({ nodeId, error }) => (
                  <li key={nodeId} className="text-copy-secondary">
                    <span className="font-medium text-copy-primary">{labelOf.get(nodeId)}</span>: {error}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <form id="jira-issues-form" onSubmit={create} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-copy-secondary">
              Jira project key
              <Input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                placeholder="e.g. ENG"
                required
                autoComplete="off"
                autoCapitalize="characters"
                className="rounded-xl"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-copy-secondary">
              Issue type
              <Input
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                required
                autoComplete="off"
                className="rounded-xl"
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-copy-secondary">
              Components ({checked.size} of {components.length} selected)
            </legend>
            {components.length === 0 ? (
              <p className="text-sm text-copy-muted">There are no components to create issues for.</p>
            ) : (
              <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-2xl border border-surface-border bg-surface p-2">
                {components.map((component) => (
                  <li key={component.nodeId}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-copy-primary hover:bg-subtle">
                      <input
                        type="checkbox"
                        checked={checked.has(component.nodeId)}
                        onChange={() => toggle(component.nodeId)}
                        className="h-4 w-4 accent-brand"
                      />
                      <span className="min-w-0 flex-1 truncate">{component.label}</span>
                      {component.existingKey && (
                        <span className="shrink-0 text-xs text-copy-muted">Has {component.existingKey}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {tooMany && (
              <p className="text-xs text-error">Choose at most {MAX_COMPONENTS} components at a time.</p>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error.text}
              {error.needsConnection && (
                <>
                  {" "}
                  <Link href="/settings/integrations" className="text-brand underline underline-offset-2">
                    Open Integrations
                  </Link>
                </>
              )}
            </p>
          )}
        </form>
      )}
    </EditorDialog>
  );
}
