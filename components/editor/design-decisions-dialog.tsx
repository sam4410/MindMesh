"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { Button } from "@/components/ui/button";
import { useCanvasFocus } from "@/hooks/use-canvas-focus";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";

// What GET /api/projects/[projectId]/decisions returns per decision.
interface DesignDecision {
  id: string;
  title: string;
  choice: string;
  reasons: string[];
  alternatives: string[];
  tradeoffs: string;
  nodeIds: string[];
  sources: { title: string; url: string }[];
  createdAt: string;
}

type Loaded = { status: "loading" } | { status: "error" } | { status: "ready"; data: DesignDecision[] };

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const CHIP_CLASS =
  "rounded-full border border-surface-border px-2.5 py-0.5 text-xs text-copy-secondary transition-colors outline-none hover:bg-subtle hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-ai/60";

interface DesignDecisionsDialogProps {
  projectId: string;
  getCanvas: () => CanvasSnapshot | null;
  onClose: () => void;
}

// The decision log (spec 72): what the AI architect decided while designing, and why, with its
// components as chips that zoom the canvas to them.
export function DesignDecisionsDialog({ projectId, getCanvas, onClose }: DesignDecisionsDialogProps) {
  const { focusNodes } = useCanvasFocus();
  const [decisions, setDecisions] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Chip labels as the canvas names the components when the dialog opens.
  const [labels] = useState(
    () =>
      new Map(
        (getCanvas()?.nodes ?? []).map((node) => [node.id, node.data.label.trim() || `Unlabeled ${node.data.shape}`])
      )
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/decisions`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Decision list failed with status ${res.status}`);
        return res.json() as Promise<{ decisions: DesignDecision[] }>;
      })
      .then(({ decisions }) => setDecisions({ status: "ready", data: decisions }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setDecisions({ status: "error" });
      });
    return () => controller.abort();
  }, [projectId, attempt]);

  function focus(nodeId: string) {
    if (focusNodes([nodeId])) onClose();
    else setNotice("That component is no longer on the canvas.");
  }

  function retry() {
    setDecisions({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <EditorDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Design decisions"
      description="Recorded by the AI architect while it designed, newest first."
      className="sm:max-w-2xl"
    >
      {notice && (
        <p role="status" className="text-xs text-warning">
          {notice}
        </p>
      )}
      {decisions.status === "loading" && (
        <p role="status" className="flex items-center gap-2 text-xs text-copy-muted">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Loading decisions…
        </p>
      )}
      {decisions.status === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-xs text-copy-muted">Couldn&apos;t load the decisions.</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {decisions.status === "ready" && decisions.data.length === 0 && (
        <p className="text-xs text-copy-muted">No recorded decisions yet. Design something with the AI architect.</p>
      )}
      {decisions.status === "ready" && decisions.data.length > 0 && (
        <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {decisions.data.map((decision) => (
            <li key={decision.id} className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-medium text-copy-primary">{decision.title}</h3>
                <time dateTime={decision.createdAt} className="shrink-0 text-xs text-copy-muted">
                  {DATE_TIME_FORMAT.format(new Date(decision.createdAt))}
                </time>
              </div>
              <p className="text-sm text-copy-secondary">{decision.choice}</p>
              <TextList title="Reasons" items={decision.reasons} />
              <TextList title="Alternatives considered" items={decision.alternatives} />
              {decision.tradeoffs && (
                <p className="text-xs leading-5 text-copy-secondary">
                  <span className="font-medium text-copy-primary">Trade-offs: </span>
                  {decision.tradeoffs}
                </p>
              )}
              {decision.nodeIds.length > 0 && (
                <div role="group" aria-label="Components" className="flex flex-wrap gap-1.5">
                  {decision.nodeIds.map((nodeId) => (
                    <button key={nodeId} type="button" onClick={() => focus(nodeId)} className={CHIP_CLASS}>
                      {labels.get(nodeId) ?? "Removed component"}
                    </button>
                  ))}
                </div>
              )}
              <Sources sources={decision.sources} />
            </li>
          ))}
        </ul>
      )}
    </EditorDialog>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-copy-primary">{title}</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-copy-secondary">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Sources({ sources }: { sources: DesignDecision["sources"] }) {
  // The design agent stores only https research sources; checked again before they become links.
  const links = sources.filter((source) => source.url.startsWith("https://"));
  if (links.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-copy-primary">Sources</p>
      <ul className="mt-1 flex flex-col gap-1 text-xs">
        {links.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ai-text underline-offset-2 hover:underline"
            >
              {source.title || source.url}
              <ExternalLink aria-hidden className="h-3 w-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
