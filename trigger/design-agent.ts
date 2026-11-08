import { logger, task } from "@trigger.dev/sdk";

interface DesignAgentPayload {
  prompt: string;
  roomId: string;
}

// shortcut: only echoes its input, add AI generation and canvas writes when that feature is specced.
export const designAgent = task({
  id: "design-agent",
  run: async ({ prompt, roomId }: DesignAgentPayload) => {
    logger.info("Design task received", { prompt, roomId });
    return { prompt, roomId };
  },
});
