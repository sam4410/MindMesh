import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { designAgent } from "@/inngest/design-agent";
import { estimateCost } from "@/inngest/estimate-cost";
import { generateAdr } from "@/inngest/generate-adr";
import { generateIac } from "@/inngest/generate-iac";
import { generateSpec } from "@/inngest/generate-spec";
import { reviewArchitecture } from "@/inngest/review-architecture";

// Inngest calls this endpoint once per step (checkpointing is off, see inngest/client.ts), so each
// step gets up to the Vercel Hobby maximum of 300 seconds. Requests are verified with the signing key.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [designAgent, generateSpec, generateAdr, reviewArchitecture, estimateCost, generateIac],
});
