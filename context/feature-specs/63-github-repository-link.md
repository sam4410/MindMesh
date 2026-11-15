Link a project to its GitHub repository and include the link in specs.

## Implementation

1. Add the field.
   - `repositoryUrl String?` on `Project` (migration `add_project_repository_url`)
   - valid format: `https://github.com/{owner}/{repo}` (owner and repo: letters, digits, `.`, `_`, `-`; optional trailing `.git` stripped)

2. Accept it in the API.
   - `PATCH /api/projects/[projectId]` accepts `repositoryUrl` (string or null to clear)
   - owner or admin only (`canManageProject`), like rename
   - 400 on an invalid URL
   - include it in `getAccessibleProject`'s `select` and the workspace page data

3. Show and edit it.
   - in the Design context dialog from spec 41, add a "Repository" field, editable by owners and admins
   - in `components/editor/editor-navbar.tsx`, show a small GitHub link icon next to the context chips when set (opens in a new tab with `rel="noopener noreferrer"`)

4. Include it in documents.
   - `POST /api/ai/spec` and `POST /api/ai/adr` pass `repositoryUrl` from the project in the payload
   - the spec and ADR prompts add a "Repository: {url}" line under the title

## Scope Limits

- don't call the GitHub API or install a GitHub App
- don't support other Git hosts yet
- don't link individual nodes to repositories

## Check When Done

- Owners and admins can set and clear the repository link; invalid URLs are rejected.
- The navbar shows the link.
- New specs and ADRs include the repository line.
- `npm run build` passes.
