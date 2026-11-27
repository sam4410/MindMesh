"use client";

import { Boxes, Download, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EditorDialog } from "@/components/editor/editor-dialog";
import { RunPoller } from "@/components/editor/run-poller";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RunState } from "@/lib/ai-status";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { DesignContext } from "@/lib/design-context";
import { IAC_FORMAT_LABELS, allowedIacFormats, type IacFormat } from "@/lib/iac-bundle";
import { postJson } from "@/lib/post-json";
import { cn } from "@/lib/utils";
import type { IacRunOutput } from "@/types/tasks";

// What GET /api/projects/[projectId]/iac returns per bundle; the zip comes from the download route.
interface BundleSummary {
  id: string;
  format: IacFormat;
  fileCount: number;
  filename: string;
  createdAt: string;
}

type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const FORMAT_BADGES: Record<IacFormat, string> = {
  TERRAFORM: "border-ai/40 text-ai-text",
  BICEP: "border-brand/40 text-brand",
};
// The decision checklist the task puts first in its notes (inngest/generate-iac.ts).
const DECISION_PREFIX = /^Decide:\s*/i;

interface IacDialogProps {
  projectId: string;
  designContext: DesignContext;
  getCanvas: () => CanvasSnapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Generates, lists and downloads infrastructure-as-code bundles (spec 67). Stays mounted while
// closed, so a running generation is still followed and its notes are there on reopening.
export function IacDialog({ projectId, designContext, getCanvas, open, onOpenChange }: IacDialogProps) {
  const formats = allowedIacFormats(designContext.cloudProvider);
  const [chosen, setChosen] = useState<IacFormat>("TERRAFORM");
  // The choice may no longer fit if the provider changed (Bicep after leaving Azure).
  const format = formats.includes(chosen) ? chosen : formats[0];
  const [bundles, setBundles] = useState<Loaded<BundleSummary[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<{ runId: string } | null>(null);
  // The latest run's notes; bundles don't keep them.
  const [notes, setNotes] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Each run is handled once.
  const finishedRunId = useRef<string | null>(null);
  const isGenerating = isStarting || activeRun !== null;

  // Loads the list each time the dialog opens, and again after a run finishes.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/iac`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`IaC list failed with status ${res.status}`);
        return res.json() as Promise<{ bundles: BundleSummary[] }>;
      })
      .then(({ bundles }) => setBundles({ status: "ready", data: bundles }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setBundles({ status: "error" });
      });
    return () => controller.abort();
  }, [projectId, open, attempt]);

  const finishRun = (run: RunState<IacRunOutput> | undefined, err?: Error) => {
    if (run && finishedRunId.current === run.id) return;
    if (run) finishedRunId.current = run.id;
    if (run?.isSuccess && run.output) {
      setNotice(null);
      setNotes(run.output.notes);
      setAttempt((n) => n + 1);
    } else if (run?.isCompleted) {
      setNotice("Couldn't generate the code. Try again.");
    } else if (err) {
      setNotice("Lost track of the generation. Try again.");
    } else {
      return;
    }
    setActiveRun(null);
  };

  // Sends the live canvas and the format to POST /api/ai/iac, then follows the run.
  async function generate() {
    if (isGenerating || !format) return;
    const canvas = getCanvas();
    if (!canvas) return setNotice("The canvas is still loading. Try again in a moment.");
    if (canvas.nodes.length === 0) return setNotice("Add something to the canvas first.");

    setNotice(null);
    setNotes(null);
    setIsStarting(true);
    try {
      const { runId } = await postJson<{ runId: string }>("/api/ai/iac", {
        roomId: projectId,
        nodes: canvas.nodes,
        edges: canvas.edges,
        format,
      });
      setActiveRun({ runId });
    } catch (err) {
      // shortcut: a 402 (spec 37's Team-plan message) gets this generic message until billing returns.
      console.error(err);
      setNotice("Couldn't start generating. Try again.");
    } finally {
      setIsStarting(false);
    }
  }

  function retry() {
    setBundles({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <>
      {/* Outside the dialog, so the run is still followed while the dialog is closed. */}
      {activeRun && <RunPoller runId={activeRun.runId} onComplete={finishRun} />}
      <EditorDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Infrastructure as code"
        description="Generate Terraform or Bicep from this design and download it as a zip."
        className="sm:max-w-lg"
      >
        {!format ? (
          <p className="rounded-2xl border border-surface-border bg-surface p-3 text-sm text-copy-secondary">
            Set a cloud provider in Design context first
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="iac-format" className="text-xs font-medium text-copy-secondary">
                  Format
                </label>
                <Select
                  items={formats.map((value) => ({ value, label: IAC_FORMAT_LABELS[value] }))}
                  value={format}
                  onValueChange={(next) => {
                    if (next) setChosen(next as IacFormat);
                  }}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="iac-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((value) => (
                      <SelectItem key={value} value={value}>
                        {IAC_FORMAT_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={generate}
                disabled={isGenerating}
                aria-busy={isGenerating}
                className="rounded-xl bg-ai text-white hover:bg-ai/90"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isGenerating ? "Generating…" : "Generate"}
              </Button>
            </div>
            {isGenerating && (
              <p className="text-xs text-copy-muted">
                This can take a few minutes. You can close this dialog; generation carries on.
              </p>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="text-xs text-copy-muted">
            {notice}
          </p>
        )}

        {notes && <RunNotes notes={notes} />}

        <section aria-labelledby="iac-bundles" className="flex flex-col gap-2">
          <h3 id="iac-bundles" className="text-xs font-medium tracking-wide text-copy-muted uppercase">
            Generated code
          </h3>
          {bundles.status === "loading" && (
            <p role="status" className="flex items-center gap-2 text-xs text-copy-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          )}
          {bundles.status === "error" && (
            <div role="alert" className="flex items-center gap-3">
              <p className="text-xs text-copy-muted">Couldn&apos;t load the generated code.</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={retry}>
                Try again
              </Button>
            </div>
          )}
          {bundles.status === "ready" && bundles.data.length === 0 && (
            <p className="text-xs text-copy-muted">No infrastructure code yet. Generate some above.</p>
          )}
          {bundles.status === "ready" && bundles.data.length > 0 && (
            <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {bundles.data.map((bundle) => (
                <li
                  key={bundle.id}
                  className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface p-3 pr-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-subtle">
                    <Boxes className="h-4 w-4 text-ai-text" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-copy-primary">{bundle.filename}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 text-[10px] leading-4 font-medium",
                          FORMAT_BADGES[bundle.format]
                        )}
                      >
                        {IAC_FORMAT_LABELS[bundle.format]}
                      </span>
                      <span className="shrink-0 text-xs text-copy-muted">
                        {bundle.fileCount} {bundle.fileCount === 1 ? "file" : "files"}
                      </span>
                      <time dateTime={bundle.createdAt} className="truncate text-xs text-copy-muted">
                        {DATE_TIME_FORMAT.format(new Date(bundle.createdAt))}
                      </time>
                    </span>
                  </span>
                  <a
                    href={`/api/projects/${projectId}/iac/${bundle.id}/download`}
                    download={bundle.filename}
                    aria-label={`Download ${bundle.filename}`}
                    title="Download zip"
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  >
                    <Download />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-copy-faint">
          Generated code must be reviewed before use. MindMesh never applies it to your cloud.
        </p>
      </EditorDialog>
    </>
  );
}

// The run's notes: the decision checklist first, then the rest.
function RunNotes({ notes }: { notes: string[] }) {
  const decisions = notes.filter((note) => DECISION_PREFIX.test(note)).map((note) => note.replace(DECISION_PREFIX, ""));
  const others = notes.filter((note) => !DECISION_PREFIX.test(note));
  if (decisions.length === 0 && others.length === 0) return null;

  return (
    <section
      aria-label="Notes from this generation"
      // Scrollable, so it's focusable for keyboard scrolling.
      tabIndex={0}
      className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-2xl border border-surface-border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-ai/60"
    >
      {decisions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-copy-primary">Decisions to confirm ({decisions.length})</h3>
          <p className="mt-0.5 text-xs text-copy-muted">
            The code uses these values by default. Confirm or change each one for your needs and for each
            environment.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-copy-secondary">
            {decisions.map((decision, index) => (
              <li key={index}>{decision}</li>
            ))}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-copy-primary">Notes</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-copy-secondary">
            {others.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
