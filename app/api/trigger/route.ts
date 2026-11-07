import { tasks } from "@trigger.dev/sdk";

import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";
import type { generateDesign } from "@/trigger/generate-design";
import type { generateSpec } from "@/trigger/generate-spec";

const MAX_PROMPT_LENGTH = 4000;

interface TriggerBody {
  task?: unknown;
  projectId?: unknown;
  prompt?: unknown;
}

// Starts a background task for a project and returns its run ID; the work happens in trigger/.
export async function POST(req: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: TriggerBody | null = null;
  try {
    body = await req.json();
  } catch {
    // Falls through to the field checks below.
  }
  const { task, projectId, prompt } = body ?? {};

  if (task !== "generate-design" && task !== "generate-spec") {
    return Response.json({ error: "task must be generate-design or generate-spec" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  const designPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (task === "generate-design" && !designPrompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (designPrompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters` },
      { status: 400 }
    );
  }

  const project = await getAccessibleProject(projectId, identity);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  try {
    const { id: runId } =
      task === "generate-design"
        ? await tasks.trigger<typeof generateDesign>(task, { projectId, prompt: designPrompt })
        : await tasks.trigger<typeof generateSpec>(task, { projectId });
    return Response.json({ runId }, { status: 202 });
  } catch (err) {
    console.error("Failed to start background task", err);
    return Response.json({ error: "Couldn't start the task" }, { status: 502 });
  }
}
