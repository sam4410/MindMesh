"use client";

import { CircleDollarSign, Download, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { RunPoller } from "@/components/editor/run-poller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanvasFocus } from "@/hooks/use-canvas-focus";
import type { RunState } from "@/lib/ai-status";
import type { CanvasSnapshot } from "@/lib/canvas-snapshot";
import type { CloudProvider } from "@/lib/cloud-services";
import { isPricedProvider } from "@/lib/cost-estimate";
import type { DesignContext } from "@/lib/design-context";
import { toCostCsv } from "@/lib/exporters/cost-csv";
import { downloadText } from "@/lib/exporters/download";
import { postJson } from "@/lib/post-json";
import { toSlug } from "@/lib/slug";
import type { CostAssumptions, CostEstimate } from "@/types/tasks";

type TrafficTier = CostAssumptions["trafficTier"];

// The sizes the cost task's prompt gives each tier (inngest/estimate-cost.ts); keep them in step.
const TRAFFIC_TIERS = [
  { value: "small", label: "Small", help: "About 10k requests/day and under 50 GB of data." },
  { value: "medium", label: "Medium", help: "About 1M requests/day and under 1 TB of data." },
  { value: "large", label: "Large", help: "About 50M requests/day and under 20 TB of data." },
] as const satisfies readonly { value: TrafficTier; label: string; help: string }[];

const DEFAULT_REGIONS: Record<CloudProvider, string> = { aws: "us-east-1", azure: "eastus", gcp: "us-central1" };

// Whole dollars, except cents for small non-whole amounts ("$0.40").
const WHOLE_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const CENTS_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatUsd = (value: number) => (value < 10 && !Number.isInteger(value) ? CENTS_USD : WHOLE_USD).format(value);
const formatRange = (low: number, high: number) => `${formatUsd(low)} – ${formatUsd(high)}`;

// Time in the viewer's locale, e.g. "3:42 PM".
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

interface CostTabProps {
  projectId: string;
  // Kept for parity with the other tabs (all stay mounted); nothing here reloads on a visit.
  isActive: boolean;
  getCanvas: () => CanvasSnapshot | null;
  designContext: DesignContext;
  // For the CSV file name.
  projectName: string;
}

// Node labels as they were when the estimate started, so rows keep their names if the canvas changes.
type RunDetails = { labels: Record<string, string>; assumptions: CostAssumptions };
type CostResult = RunDetails & { estimate: CostEstimate; at: Date };

export function CostTab({ projectId, getCanvas, designContext, projectName }: CostTabProps) {
  const { focusNodes } = useCanvasFocus();
  const provider = designContext.cloudProvider;
  const [trafficTier, setTrafficTier] = useState<TrafficTier>("small");
  // null until edited, so the default follows the project's provider.
  const [regionDraft, setRegionDraft] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<(RunDetails & { runId: string }) | null>(null);
  // The latest estimate only; estimates aren't saved (spec 65).
  const [result, setResult] = useState<CostResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Each run is handled once.
  const finishedRunId = useRef<string | null>(null);
  const isEstimating = isStarting || activeRun !== null;
  const region = regionDraft ?? (isPricedProvider(provider) ? DEFAULT_REGIONS[provider] : "");

  const finishRun = (run: RunState<CostEstimate> | undefined, err?: Error) => {
    if (run && finishedRunId.current === run.id) return;
    if (run) finishedRunId.current = run.id;
    if (run?.isSuccess && run.output && activeRun) {
      setNotice(null);
      setResult({ estimate: run.output, labels: activeRun.labels, assumptions: activeRun.assumptions, at: new Date() });
    } else if (run?.isCompleted) {
      setNotice("Couldn't estimate the cost. Try again.");
    } else if (err) {
      setNotice("Lost track of the estimate. Try again.");
    } else {
      return;
    }
    setActiveRun(null);
  };

  // Sends the live canvas and the assumptions to POST /api/ai/cost, then follows the run.
  async function estimate() {
    if (isEstimating) return;
    const canvas = getCanvas();
    if (!canvas) return setNotice("The canvas is still loading. Try again in a moment.");
    if (canvas.nodes.length === 0) return setNotice("Add something to the canvas first.");
    const assumptions: CostAssumptions = { trafficTier, region: region.trim() };
    if (!assumptions.region) return setNotice("Enter a region.");
    const labels = Object.fromEntries(
      canvas.nodes.map((node) => [node.id, node.data.label.trim() || `Unlabeled ${node.data.shape}`])
    );

    setNotice(null);
    setIsStarting(true);
    try {
      const { runId } = await postJson<{ runId: string }>("/api/ai/cost", {
        roomId: projectId,
        nodes: canvas.nodes,
        edges: canvas.edges,
        assumptions,
      });
      setActiveRun({ runId, labels, assumptions });
    } catch (err) {
      // shortcut: a 402 limit_reached (spec 37) gets this generic message until billing returns.
      console.error(err);
      setNotice("Couldn't start the estimate. Try again.");
    } finally {
      setIsStarting(false);
    }
  }

  function focusRow(nodeId: string) {
    setNotice(focusNodes([nodeId]) ? null : "That component is no longer on the canvas.");
  }

  function downloadCsv({ estimate, labels }: CostResult) {
    const csv = toCostCsv(estimate, (id) => labels[id] ?? id);
    downloadText(csv, `${toSlug(projectName) || "project"}-cost-estimate.csv`, "text/csv;charset=utf-8");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {activeRun && <RunPoller runId={activeRun.runId} onComplete={finishRun} />}
      {!isPricedProvider(provider) ? (
        <EmptyState
          title="No cloud provider"
          text="Set a cloud provider in Design context to estimate costs"
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 p-4 pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label htmlFor="cost-traffic" className="text-xs font-medium text-copy-secondary">
                  Traffic
                </label>
                <Select
                  items={TRAFFIC_TIERS}
                  value={trafficTier}
                  onValueChange={(next) => {
                    if (next) setTrafficTier(next as TrafficTier);
                  }}
                  disabled={isEstimating}
                >
                  <SelectTrigger id="cost-traffic" aria-describedby="cost-traffic-help" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAFFIC_TIERS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cost-region" className="text-xs font-medium text-copy-secondary">
                  Region
                </label>
                <Input
                  id="cost-region"
                  value={region}
                  onChange={(event) => setRegionDraft(event.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isEstimating}
                />
              </div>
            </div>
            <p id="cost-traffic-help" className="text-xs text-copy-faint">
              {TRAFFIC_TIERS.find((tier) => tier.value === trafficTier)?.help}
            </p>
            <Button
              onClick={estimate}
              disabled={isEstimating || !region.trim()}
              aria-busy={isEstimating}
              className="w-full rounded-xl bg-ai text-white hover:bg-ai/90"
            >
              {isEstimating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isEstimating ? "Estimating…" : "Estimate cost"}
            </Button>
            {notice && (
              <p role="status" className="text-xs text-copy-muted">
                {notice}
              </p>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {result ? (
              <CostResultView result={result} onFocusRow={focusRow} onDownload={() => downloadCsv(result)} />
            ) : (
              <EmptyState
                title="No estimate yet"
                text="Prices each component at on-demand list prices for the region and traffic you choose."
              />
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle">
        <CircleDollarSign className="h-6 w-6 text-ai-text" />
      </span>
      <p className="text-sm font-medium text-copy-primary">{title}</p>
      <p className="text-xs text-copy-muted">{text}</p>
    </div>
  );
}

interface CostResultViewProps {
  result: CostResult;
  onFocusRow: (nodeId: string) => void;
  onDownload: () => void;
}

function CostResultView({ result, onFocusRow, onDownload }: CostResultViewProps) {
  const { estimate, labels, assumptions, at } = result;
  const labelOf = (id: string) => labels[id] ?? id;
  const tierLabel = TRAFFIC_TIERS.find((tier) => tier.value === assumptions.trafficTier)?.label ?? assumptions.trafficTier;

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      <section aria-labelledby="cost-components">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="cost-components" className="text-xs font-medium tracking-wide text-copy-muted uppercase">
            Monthly cost
          </h3>
          <Button variant="outline" size="sm" onClick={onDownload} className="rounded-lg">
            <Download />
            Download CSV
          </Button>
        </div>
        <table className="w-full table-fixed text-left text-xs">
          <thead className="text-copy-muted">
            <tr>
              <th scope="col" className="w-[28%] pb-1.5 pr-2 font-medium">Component</th>
              <th scope="col" className="w-[22%] pb-1.5 pr-2 font-medium">Service</th>
              <th scope="col" className="w-[20%] pb-1.5 pr-2 font-medium">Tier</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {estimate.lineItems.length === 0 && (
              <tr className="border-t border-surface-border">
                <td colSpan={4} className="py-2 text-copy-muted">
                  Nothing on the canvas could be priced.
                </td>
              </tr>
            )}
            {estimate.lineItems.map((item, index) => (
              // The whole row focuses its node; the button inside gives keyboard users the same action
              // (its click bubbles up to the row).
              <tr
                key={index}
                onClick={() => onFocusRow(item.nodeId)}
                title="Show on canvas"
                className="cursor-pointer border-t border-surface-border align-top transition-colors hover:bg-subtle"
              >
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    aria-label={`${labelOf(item.nodeId)}: show on canvas`}
                    className="rounded-sm text-left font-medium break-words text-copy-primary outline-none focus-visible:ring-2 focus-visible:ring-ai/60"
                  >
                    {labelOf(item.nodeId)}
                  </button>
                </td>
                <td className="py-2 pr-2 break-words text-copy-secondary">{item.service}</td>
                <td className="py-2 pr-2 break-words text-copy-secondary">{item.tier}</td>
                <td className="py-2 text-right text-copy-primary">{formatRange(item.monthlyLow, item.monthlyHigh)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-border font-bold text-copy-primary">
              <th scope="row" colSpan={3} className="py-2">
                Total
              </th>
              <td className="py-2 text-right">{formatRange(estimate.totalLow, estimate.totalHigh)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1 text-xs text-copy-faint">Rough list-price estimate, not a quote.</p>
      </section>

      {estimate.unpricedNodeIds.length > 0 && (
        <section aria-labelledby="cost-unpriced">
          <h3 id="cost-unpriced" className="mb-2 text-xs font-medium tracking-wide text-copy-muted uppercase">
            Not priced ({estimate.unpricedNodeIds.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {estimate.unpricedNodeIds.map((id) => (
              <li key={id} className="rounded-full bg-subtle px-2 py-0.5 text-xs text-copy-secondary">
                {labelOf(id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {estimate.caveats.length > 0 && (
        <section aria-labelledby="cost-caveats">
          <h3 id="cost-caveats" className="mb-2 text-xs font-medium tracking-wide text-copy-muted uppercase">
            Caveats
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-copy-secondary">
            {estimate.caveats.map((caveat, index) => (
              <li key={index}>{caveat}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-copy-faint">
        Estimated at <time dateTime={at.toISOString()}>{TIME_FORMAT.format(at)}</time> for {tierLabel.toLowerCase()}{" "}
        traffic in {assumptions.region}. Estimates aren&apos;t saved: this one is gone when you reload the page.
      </p>
    </div>
  );
}
