"use client";

import { ClipboardCheck, Loader2, LocateFixed, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { RunPoller } from "@/components/editor/run-poller";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasFocus } from "@/hooks/use-canvas-focus";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import { postJson } from "@/lib/post-json";
import { cn } from "@/lib/utils";
import { REVIEW_SEVERITIES, type ReviewPillar, type ReviewResult } from "@/types/tasks";

const PILLAR_LABELS: Record<ReviewPillar, string> = {
  reliability: "Reliability",
  security: "Security",
  cost: "Cost",
  performance: "Performance",
  operations: "Operations",
};

const SEVERITY_STYLES = {
  high: { label: "High", className: "text-error" },
  medium: { label: "Medium", className: "text-warning" },
  low: { label: "Low", className: "text-copy-muted" },
} as const;

// Time in the viewer's locale, e.g. "3:42 PM".
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

interface ReviewTabProps {
  projectId: string;
  // Kept for parity with the Specs tab (both stay mounted); nothing here reloads on a visit.
  isActive: boolean;
  getCanvas: () => CanvasSnapshot | null;
}

type Finding = ReviewResult["findings"][number];

export function ReviewTab({ projectId, getCanvas }: ReviewTabProps) {
  const { focusNodes } = useCanvasFocus();
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<{ runId: string } | null>(null);
  // The latest review only; it isn't saved anywhere (spec 53).
  const [result, setResult] = useState<{ review: ReviewResult; at: Date } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Each run is handled once.
  const finishedRunId = useRef<string | null>(null);
  const isReviewing = isStarting || activeRun !== null;

  const finishRun = (
    run: { id: string; isCompleted: boolean; isSuccess: boolean; output?: ReviewResult } | undefined,
    err?: Error
  ) => {
    if (run && finishedRunId.current === run.id) return;
    if (run) finishedRunId.current = run.id;
    if (run?.isSuccess && run.output) {
      setNotice(null);
      setResult({ review: run.output, at: new Date() });
    } else if (run?.isCompleted) {
      setNotice("Couldn't review the architecture. Try again.");
    } else if (err) {
      setNotice("Lost track of the review. Try again.");
    } else {
      return;
    }
    setActiveRun(null);
  };

  // Sends the live canvas to POST /api/ai/review, then follows the run.
  async function review() {
    if (isReviewing) return;
    const canvas = getCanvas();
    if (!canvas) return setNotice("The canvas is still loading. Try again in a moment.");
    if (canvas.nodes.length === 0) return setNotice("Add something to the canvas first.");

    setNotice(null);
    setIsStarting(true);
    try {
      const { runId } = await postJson<{ runId: string }>("/api/ai/review", {
        roomId: projectId,
        nodes: canvas.nodes,
        edges: canvas.edges,
      });
      setActiveRun({ runId });
    } catch (err) {
      // shortcut: a 402 limit_reached (spec 37) gets this generic message until billing returns.
      console.error(err);
      setNotice("Couldn't start the review. Try again.");
    } finally {
      setIsStarting(false);
    }
  }

  function focusFinding(finding: Finding) {
    const found = focusNodes(finding.nodeIds);
    setNotice(found ? null : "Those nodes are no longer on the canvas.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {activeRun && (
        <RunPoller runId={activeRun.runId} onComplete={finishRun} />
      )}
      <div className="flex flex-col gap-2 p-4 pb-3">
        <Button
          onClick={review}
          disabled={isReviewing}
          aria-busy={isReviewing}
          className="w-full rounded-xl bg-ai text-white hover:bg-ai/90"
        >
          {isReviewing ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {isReviewing ? "Reviewing…" : "Review architecture"}
        </Button>
        {notice && (
          <p role="status" className="text-xs text-copy-muted">
            {notice}
          </p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!result && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
              <ClipboardCheck className="h-6 w-6 text-ai-text" />
            </span>
            <p className="text-sm font-medium text-copy-primary">No review yet</p>
            <p className="text-xs text-copy-muted">
              Scores the design on reliability, security, cost, performance and operations, and lists what to fix.
            </p>
          </div>
        )}
        {result && <ReviewResultView review={result.review} at={result.at} onFocusFinding={focusFinding} />}
      </ScrollArea>
    </div>
  );
}

interface ReviewResultViewProps {
  review: ReviewResult;
  at: Date;
  onFocusFinding: (finding: Finding) => void;
}

function ReviewResultView({ review, at, onFocusFinding }: ReviewResultViewProps) {
  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <p className="text-sm leading-6 text-copy-secondary">{review.summary}</p>

      <section aria-labelledby="review-pillars">
        <h3 id="review-pillars" className="mb-2 text-xs font-medium tracking-wide text-copy-muted uppercase">
          Pillars
        </h3>
        <ul className="flex flex-col gap-3">
          {review.pillars.map((entry) => (
            <li key={entry.pillar}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-copy-primary">{PILLAR_LABELS[entry.pillar]}</span>
                <ScoreDots score={entry.score} />
              </div>
              <p className="mt-0.5 text-xs leading-5 text-copy-muted">{entry.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="review-findings">
        <h3 id="review-findings" className="mb-2 text-xs font-medium tracking-wide text-copy-muted uppercase">
          Findings ({review.findings.length})
        </h3>
        {review.findings.length === 0 && <p className="text-xs text-copy-muted">No findings.</p>}
        {REVIEW_SEVERITIES.map((severity) => {
          const findings = review.findings.filter((finding) => finding.severity === severity);
          if (findings.length === 0) return null;
          const style = SEVERITY_STYLES[severity];
          return (
            <div key={severity} className="mb-3">
              <h4 className={cn("mb-1.5 text-xs font-semibold", style.className)}>
                {style.label} ({findings.length})
              </h4>
              <ul className="flex flex-col gap-2">
                {findings.map((finding, index) => (
                  <li key={`${severity}-${index}`}>
                    <FindingCard finding={finding} onFocus={onFocusFinding} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <p className="text-xs text-copy-faint">
        Reviewed at <time dateTime={at.toISOString()}>{TIME_FORMAT.format(at)}</time>. Reviews aren&apos;t saved: this
        one is gone when you reload the page.
      </p>
    </div>
  );
}

function ScoreDots({ score }: { score: number }) {
  return (
    <span role="img" aria-label={`Score ${score} of 5`} className="flex shrink-0 gap-1">
      {[1, 2, 3, 4, 5].map((dot) => (
        <span
          key={dot}
          aria-hidden
          className={cn("h-2 w-2 rounded-full", dot <= score ? "bg-ai" : "border border-surface-border bg-subtle")}
        />
      ))}
    </span>
  );
}

function FindingCard({ finding, onFocus }: { finding: Finding; onFocus: (finding: Finding) => void }) {
  const content = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-copy-primary">{finding.title}</span>
        <span className="shrink-0 rounded-full bg-subtle px-2 py-px text-[11px] text-copy-muted">
          {PILLAR_LABELS[finding.pillar]}
        </span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-copy-secondary">{finding.detail}</span>
      <span className="mt-1.5 block text-xs leading-5 text-copy-secondary">
        <span className="font-medium text-copy-primary">Recommendation: </span>
        {finding.recommendation}
      </span>
    </>
  );
  const cardClass = "block w-full rounded-2xl border border-surface-border bg-elevated p-3 text-left";

  // Findings about the design as a whole have no nodes to show, so they aren't clickable.
  if (finding.nodeIds.length === 0) return <div className={cardClass}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onFocus(finding)}
      title="Show these nodes on the canvas"
      className={cn(
        cardClass,
        "transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ai/60 focus-visible:outline-none"
      )}
    >
      {content}
      <span className="mt-1.5 flex items-center gap-1 text-[11px] text-ai-text">
        <LocateFixed aria-hidden className="h-3 w-3" />
        Show {finding.nodeIds.length === 1 ? "node" : `${finding.nodeIds.length} nodes`} on canvas
      </span>
    </button>
  );
}
