// Atlassian Document Format (ADF), the JSON rich-text format Jira Cloud's v3 API takes for issue
// descriptions (spec 62). Only the nodes used here: paragraphs and bullet lists of plain text.

type AdfText = { type: "text"; text: string };
type AdfParagraph = { type: "paragraph"; content: AdfText[] };
type AdfBulletList = { type: "bulletList"; content: { type: "listItem"; content: AdfParagraph[] }[] };
export type AdfDocument = { type: "doc"; version: 1; content: (AdfParagraph | AdfBulletList)[] };

// ADF rejects empty text nodes, so an empty paragraph has no content.
const paragraph = (text: string): AdfParagraph => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });

const bulletList = (items: string[]): AdfBulletList => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
});

export interface IssueDescriptionInput {
  projectName: string;
  label: string;
  // The managed service's full name, e.g. "Azure Cosmos DB"; omitted when the node has none.
  service?: string;
  // "Order Intake → Order Queue: Publish Order", one per connection.
  incoming: string[];
  outgoing: string[];
}

export function buildIssueDescription({ projectName, service, incoming, outgoing }: IssueDescriptionInput): AdfDocument {
  const content: AdfDocument["content"] = [paragraph(`Component from the MindMesh design '${projectName}'.`)];
  if (service) content.push(paragraph(`Service: ${service}`));
  const lines = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
  if (lines(incoming).length) content.push(paragraph("Incoming connections:"), bulletList(lines(incoming)));
  if (lines(outgoing).length) content.push(paragraph("Outgoing connections:"), bulletList(lines(outgoing)));
  return { type: "doc", version: 1, content };
}
