import { getCurrentIdentity } from "@/lib/project-access";
import { getRunState } from "@/lib/task-runs";

type Context = RouteContext<"/api/ai/runs/[runId]">;

// A background AI run's state, polled by the browser that started it: { id, isCompleted,
// isSuccess, output? }. Only the user who started the run can read it.
export async function GET(_req: Request, ctx: Context) {
  const { runId } = await ctx.params;
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const run = await getRunState(runId, identity.userId);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json(run, { headers: { "cache-control": "private, no-store" } });
}
