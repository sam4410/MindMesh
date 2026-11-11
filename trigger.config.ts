import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";

const project = process.env.TRIGGER_PROJECT_REF;
if (!project) {
  throw new Error("TRIGGER_PROJECT_REF is required to configure Trigger.dev");
}

export default defineConfig({
  project,
  runtime: "node",
  dirs: ["./trigger"],
  maxDuration: 3600,
  // Prisma 7 client is generated locally (postinstall); this keeps @prisma/client external in the deploy image.
  build: { extensions: [prismaExtension({ mode: "modern" })] },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      randomize: true,
    },
  },
});
