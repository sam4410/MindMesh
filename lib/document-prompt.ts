import { boundaryMembers } from "@/lib/boundaries";
import { getCloudService, serviceFullName } from "@/lib/cloud-services";
import type { GenerateSpecPayload } from "@/types/tasks";

// Prompt input shared by the generate-spec and generate-adr tasks: the canvas graph and the team
// chat as lines of text. Each task adds its own design-context instructions after these lines.
export function describeCanvasAndChat({ nodes, edges, chatHistory }: Pick<GenerateSpecPayload, "nodes" | "edges" | "chatHistory">) {
  const names = new Map(
    nodes.map((node) => [node.id, node.data.label.trim() || `unlabeled ${node.data.shape}`])
  );
  const nameOf = (id: string) => names.get(id) ?? id;

  // A boundary is a group outline (spec 68), described by what it contains rather than as a component.
  const components = nodes.filter((node) => node.data.shape !== "boundary");
  const boundaries = nodes.filter((node) => node.data.shape === "boundary");

  const nodeLines = components.map((node) => {
    const service = getCloudService(node.data.service);
    const managed = service ? `, managed service: ${serviceFullName(service)}` : "";
    return `- ${nameOf(node.id)} (${node.data.shape}${managed})`;
  });
  const boundaryLines = boundaries.map((boundary) => {
    const members = boundaryMembers(boundary, components).map((node) => nameOf(node.id));
    return `- ${nameOf(boundary.id)}: ${members.length ? members.join(", ") : "(no components inside)"}`;
  });
  const edgeLines = edges.map((edge) => {
    const label = edge.data?.label?.trim();
    return `- ${nameOf(edge.source)} -> ${nameOf(edge.target)}${label ? `: ${label}` : ""}`;
  });
  const chatLines = chatHistory.map(
    (message) => `${message.sender.name} (${message.role}): ${message.content}`
  );
  return [
    `Canvas nodes (${components.length}):`,
    ...nodeLines,
    "",
    ...(boundaryLines.length
      ? [
          `Boundaries (${boundaryLines.length}) — groups such as security, network, or compliance zones, not components; boundary: components inside:`,
          ...boundaryLines,
          "",
        ]
      : []),
    `Canvas edges (${edges.length}), source -> target: interaction:`,
    ...(edgeLines.length ? edgeLines : ["(none)"]),
    "",
    "Team chat, oldest first:",
    ...(chatLines.length ? chatLines : ["(none)"]),
  ];
}

// The "Repository: {url}" line under the document's title (spec 63); nothing when there's no link.
export function repositoryInstruction(repositoryUrl: string | null | undefined) {
  return repositoryUrl
    ? ["", `Repository: ${repositoryUrl}`, `Directly under the title, before any other line, add this line exactly: Repository: ${repositoryUrl}`]
    : [];
}

// Models sometimes wrap the whole answer in a ```markdown fence despite the instructions.
export function unwrapFence(text: string) {
  const trimmed = text.trim();
  const match = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return (match ? match[1] : trimmed).trim();
}
