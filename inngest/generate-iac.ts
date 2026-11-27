import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { NonRetriableError } from "inngest";

import { iacRequested, inngest } from "@/inngest/client";

import { boundaryMembers } from "@/lib/boundaries";
import { getCloudService, serviceFullName } from "@/lib/cloud-services";
import { CLOUD_PROVIDERS, EMPTY_DESIGN_CONTEXT, formatDesignContext } from "@/lib/design-context";
import { IAC_FORMAT_LABELS, iacFilesError, iacFormatError, withReadme, type IacFormat } from "@/lib/iac-bundle";
import { saveIacBundle } from "@/lib/iac-bundle-store";
import { completeTaskRun, failTaskRun, loadRunInput } from "@/lib/task-runs";
import { iacOutputSchema, iacPayloadSchema, type IacPayload, type IacRunOutput } from "@/types/tasks";

// The review's model (inngest/review-architecture.ts); kept in step by hand.
const MODEL_ID = "gpt-6-luna";
// A whole bundle is a long answer. Under the 300-second limit per step (app/api/inngest/route.ts),
// with room to zip and upload.
const IAC_TIMEOUT_MS = 240_000;

const FILE_LAYOUT: Record<IacFormat, string> = {
  TERRAFORM: `- main.tf: a terraform block with required_providers and pinned provider versions, the provider configuration, and one module call per component.
- variables.tf and outputs.tf at the root.
- One module per component in a single file, modules/<component_name>/main.tf, holding its variables, resources and outputs (one file per module keeps large designs within the file limit). Components of the same kind may share one module.
- environments/dev.tfvars.example and environments/prod.tfvars.example: example values for each environment, smaller for dev and production-ready for prod.`,
  BICEP: `- main.bicep: the parameters and one module per component.
- One module per component at modules/<componentName>.bicep.
- environments/dev.parameters.json and environments/prod.parameters.json: ARM parameter files with example values for each environment, smaller for dev and production-ready for prod.`,
};

function systemPrompt(format: IacFormat) {
  const language = IAC_FORMAT_LABELS[format];
  return `You are MindMesh, a senior cloud platform engineer. Write ${language} code that deploys a system design a team drew on a shared canvas. It is a starting point the team reviews before using; MindMesh never applies it.

Files:
${FILE_LAYOUT[format]}
- README.md: what the code creates, a "Decisions to confirm" section repeating the decision checklist from notes, and how to review, plan and apply it.
Paths are relative and use "/". Only these extensions: .tf, .tfvars.example, .bicep, .json, .md. At most 40 files and 200 KB in all.

Rules:
- Write valid ${language} for current provider versions.${
    format === "TERRAFORM"
      ? `
- Format HCL the way terraform fmt does: one argument per line. Never use semicolons; HCL has no statement separator, and a block written on one line may hold only one argument.`
      : ""
  }
- Example values for each environment must work with what the code configures, such as a tier that supports the networking you set up.
- Cover every component node. When a node names a managed service, use that service's resource type. Nodes that aren't cloud resources (users, browsers, mobile apps, third-party systems) get no code; say so in notes.
- Boundaries are zones such as PCI scope or a network segment: use them for network isolation and grouping, not as resources of their own.
- Edges are interactions: use them for networking, identities and role assignments, and connection settings between components.
- Never write secrets, keys, passwords, connection strings, or subscription, tenant, project or account IDs. Use variables (parameters in Bicep) with placeholder defaults in angle brackets, such as "<subscription-id>", and mark secret ones as sensitive (@secure() in Bicep).
- Every configuration value you choose for the team is a variable (parameter in Bicep) with that value as its default and a description, so each environment can set its own. That includes SKU or tier, instance size and count, scaling limits, storage size, replication and redundancy, backup retention, network exposure and region.

notes:
- First the decision checklist: one entry per configuration value from the last rule, each written as "Decide: <component> <setting> = <value used>. <what to weigh, such as dev against production needs>". These values were chosen by default, so the team must confirm or change each one for their needs and each environment.
- Then other notes: assumptions, components that got no code, and what to add before production.`;
}

export const generateIac = inngest.createFunction(
  {
    id: "generate-iac",
    triggers: [iacRequested],
    // A retry would run (and bill) the model call again, as for the review and cost estimate.
    retries: 0,
    onFailure: async ({ event, error }) => {
      console.error("IaC generation failed", { error: error.message });
      await failTaskRun(event.data.event.data.runId);
    },
  },
  async ({ event, step }) => {
    const { runId } = event.data;
    const result = await step.run("generate", async (): Promise<IacRunOutput> => {
      const payload = await loadRunInput(runId, iacPayloadSchema);
      // POST /api/ai/iac checks this too; the payload is what gets generated.
      const formatError = iacFormatError(payload.designContext.cloudProvider, payload.format);
      if (formatError) throw new NonRetriableError(formatError);

      const { output } = await generateText({
        model: openai(MODEL_ID), // openai() reads OPENAI_API_KEY.
        system: systemPrompt(payload.format),
        prompt: describeDesign(payload),
        output: Output.object({ schema: iacOutputSchema }),
        abortSignal: AbortSignal.timeout(IAC_TIMEOUT_MS),
      });

      const files = withReadme(output.files, payload.format, output.notes);
      const filesError = iacFilesError(files);
      if (filesError) throw new NonRetriableError(filesError);
      const bundleId = await saveIacBundle(payload.projectId, payload.format, files);

      console.info("IaC generated", {
        projectId: payload.projectId,
        bundleId,
        format: payload.format,
        files: files.length,
        readmeAdded: files.length > output.files.length,
        decisions: output.notes.filter((note) => note.startsWith("Decide:")).length,
        notes: output.notes.length,
      });
      return { bundleId, notes: output.notes };
    });
    // The browser reads the bundle ID and notes from the run (spec 67).
    await step.run("finish", () => completeTaskRun(runId, result));
    return result;
  }
);

// The canvas as text: components with their managed services, boundaries with their members, and edges.
function describeDesign({ nodes, edges, designContext, format }: IacPayload) {
  const context = { ...EMPTY_DESIGN_CONTEXT, ...designContext };
  const names = new Map(nodes.map((node) => [node.id, node.data.label.trim() || `unlabeled ${node.data.shape}`]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const providerLabel = CLOUD_PROVIDERS.find((option) => option.id === context.cloudProvider)?.label;

  const components = nodes.filter((node) => node.data.shape !== "boundary");
  const boundaries = nodes.filter((node) => node.data.shape === "boundary");
  const nodeLines = components.map((node) => {
    const service = getCloudService(node.data.service);
    const managed = service ? `, managed service: ${serviceFullName(service)}` : "";
    return `- [${node.id}] ${nameOf(node.id)} (${node.data.shape}${managed})`;
  });
  const boundaryLines = boundaries.map((boundary) => {
    const members = boundaryMembers(boundary, components).map((node) => nameOf(node.id));
    return `- ${nameOf(boundary.id)}: ${members.length ? members.join(", ") : "(no components inside)"}`;
  });
  const edgeLines = edges.map((edge) => {
    const label = edge.data?.label?.trim();
    return `- ${nameOf(edge.source)} -> ${nameOf(edge.target)}${label ? `: ${label}` : ""}`;
  });

  return [
    `Cloud provider: ${providerLabel}`,
    `Language: ${IAC_FORMAT_LABELS[format]}`,
    `Project context: ${formatDesignContext(context)}`,
    "",
    `Components (${components.length}), [id] name (shape):`,
    ...nodeLines,
    "",
    ...(boundaryLines.length ? [`Boundaries (${boundaryLines.length}), name: components inside:`, ...boundaryLines, ""] : []),
    `Edges (${edges.length}), source -> target: interaction:`,
    ...(edgeLines.length ? edgeLines : ["(none)"]),
  ].join("\n");
}
