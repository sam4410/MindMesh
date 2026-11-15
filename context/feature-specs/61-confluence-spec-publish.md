Publish a generated spec or ADR to Confluence as a new page.

## Implementation

1. Convert Markdown to Confluence storage format.
   - install `marked`
   - `lib/atlassian/confluence.ts`: `markdownToStorage(markdown)` renders HTML with `marked` (GFM tables on) and returns XHTML-safe output (self-closing `<br/>` and `<hr/>`, escaped `&`)
   - wrap fenced code blocks in the Confluence code macro: `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">…</ac:parameter><ac:plain-text-body><![CDATA[…]]></ac:plain-text-body></ac:structured-macro>`

2. Add `POST /api/projects/[projectId]/specs/[specId]/publish/confluence`.
   - body `{ spaceKey: string, parentPageId?: string }`
   - authenticate, check project access, and check the spec belongs to the project
   - load the workspace's Atlassian integration (404 `{ error: "Connect Atlassian first" }` if missing) and decrypt the token
   - read the Markdown from Blob (same `get` call as the download route)
   - look up the space ID: `GET {site}/wiki/api/v2/spaces?keys={spaceKey}`; 400 if not found
   - create the page: `POST {site}/wiki/api/v2/pages` with `spaceId`, `status: "current"`, `title` = "{Project name} – {Technical spec | Decision records} ({date})", optional `parentId`, and `body: { representation: "storage", value }`
   - 10-second timeout per call; map Atlassian 401/403 to 400 `{ error: "Atlassian rejected the request. Check the connection and space permissions." }`
   - save the page URL in a new `publishedUrl String?` on `ProjectSpec` (migration `add_spec_published_url`)
   - return `{ url }`

3. Add the UI.
   - in the spec preview dialog (`specs-tab.tsx`), add "Publish to Confluence" when the workspace has an Atlassian connection
   - it shows a small form: space key (remember the last one in `localStorage`, wrapped in try/catch) and optional parent page ID
   - on success, show "Published" with a link to the page; rows with a `publishedUrl` show a Confluence link icon

## Scope Limits

- don't update existing pages; publishing again creates a new page
- don't sync comments or edits back from Confluence
- don't add Notion

## Check When Done

- A spec publishes to a chosen Confluence space with headings, tables, and code blocks intact.
- Missing connection, bad space key, and permission errors show clear messages.
- The spec row links to the published page.
- `npm run build` passes.
