import { logger, task } from "@trigger.dev/sdk";

interface GenerateDesignPayload {
  projectId: string;
  prompt: string;
}

// shortcut: example task with no AI call or canvas write, replace once the design feature is specced.
export const generateDesign = task({
  id: "generate-design",
  run: async ({ projectId, prompt }: GenerateDesignPayload) => {
    logger.info("Design generation requested", { projectId, promptLength: prompt.length });
    return { projectId, generated: false };
  },
});
