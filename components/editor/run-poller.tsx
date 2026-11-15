"use client";

import { useApiClient } from "@trigger.dev/react-hooks";
import type { AnyTask, RetrieveRunResult } from "@trigger.dev/sdk";
import { useEffect, useRef } from "react";

import { RUN_POLL_INTERVAL_MS } from "@/lib/ai-status";

// Fallback for a run whose realtime "completed" update never reaches the browser: checks it every
// RUN_POLL_INTERVAL_MS until it completes. Mount it only while the run is active, because
// useApiClient throws without an access token. A plain interval rather than useRun: useRun's SWR
// timer restarts on every re-render, and status updates re-render the sidebar constantly.
export function RunPoller<TTask extends AnyTask>({
  runId,
  accessToken,
  onComplete,
}: {
  runId: string;
  accessToken: string;
  onComplete: (run: RetrieveRunResult<TTask>) => void;
}) {
  const client = useApiClient({ accessToken });
  // Both change identity every render; the interval reads the newest ones without restarting.
  const latest = useRef({ client, onComplete });
  useEffect(() => {
    latest.current = { client, onComplete };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      latest.current.client
        ?.retrieveRun(runId)
        .then((run) => {
          // Same cast useRun makes: retrieveRun returns the untyped run.
          if (run.isCompleted) latest.current.onComplete(run as RetrieveRunResult<TTask>);
        })
        .catch(() => {}); // a failed check is retried on the next tick
    }, RUN_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runId]);

  return null;
}
