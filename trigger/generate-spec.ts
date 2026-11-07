import { logger, task } from "@trigger.dev/sdk";

interface GenerateSpecPayload {
  projectId: string;
}

// shortcut: example task with no AI call or Blob write, replace once the spec feature is specced.
export const generateSpec = task({
  id: "generate-spec",
  run: async ({ projectId }: GenerateSpecPayload) => {
    logger.info("Spec generation requested", { projectId });
    return { projectId, generated: false };
  },
});
