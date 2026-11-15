Create Jira issues from canvas components, so a design turns into implementation work.

## Implementation

1. Build issue descriptions: `lib/atlassian/adf.ts`.
   - `buildIssueDescription({ projectName, label, service, incoming, outgoing })` returns an Atlassian Document Format document with:
     - a paragraph: "Component from the MindMesh design '{projectName}'."
     - "Service: {service name}" when set
     - bullet lists of incoming and outgoing connections, using edge labels ("Order Intake → Order Queue: Publish Order")

2. Add `POST /api/projects/[projectId]/jira/issues`.
   - body `{ jiraProjectKey: string, issueType: string (default "Task"), components: [{ nodeId, label, service?, incoming: string[], outgoing: string[] }] }`, max 25 components
   - the client sends component details from the canvas; the server validates sizes and builds the descriptions
   - authenticate, check project access, load and decrypt the Atlassian integration (404 if missing)
   - create each issue with `POST {site}/rest/api/3/issue`, summary "Implement {label}", 10-second timeout per call
   - continue after a failed issue; return `{ created: [{ nodeId, key, url }], failed: [{ nodeId, error }] }`

3. Link issues on the canvas.
   - add optional `jiraIssue?: { key: string; url: string }` to `CanvasNodeData` in `types/canvas.ts`
   - after the response, the client writes `jiraIssue` into each created node with `updateNodeData`, so every collaborator sees it
   - `canvas-node.tsx` shows a small issue-key badge linking to the issue

4. Add the UI.
   - "Create Jira issues" in the node selection toolbar (selected nodes) and in the Export menu (all nodes)
   - a dialog with Jira project key, issue type, and a checklist of components (nodes that already have an issue are unchecked by default)
   - shows results: created keys with links, and failures with reasons

## Scope Limits

- don't sync issue status back from Jira
- don't create epics or links between issues
- don't change the AI tasks

## Check When Done

- Selected components become Jira issues with descriptions listing their connections.
- Nodes show their issue key, visible to all collaborators.
- Partial failures are reported without losing the created issues.
- `npm run build` passes.
