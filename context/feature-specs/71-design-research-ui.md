Let users turn on best-practice research for a design request, and show the documents the AI used in its chat reply.

## Implementation

1. Add the toggle.
   - in `components/editor/ai-sidebar.tsx`, under the prompt textarea, add a small switch-style checkbox "Research best practices" with a help line: "Checks official cloud documentation first. Adds about 10–30 seconds."
   - send `research: true|false` with `POST /api/ai/design`
   - remember the choice per browser in `localStorage` (key `mindmesh:research`, wrapped in try/catch), default off
   - disable it while a run is active

2. Show progress.
   - the existing status line already displays the latest AI status, so "Researching best practices…" appears without further changes; confirm it does

3. Show sources in the chat.
   - in `designRunMessage` (`ai-sidebar.tsx`), when the run output has `sources`, append them to the assistant message as `Sources:` followed by one `- Title (URL)` line each, keeping the message within `CHAT_MESSAGE_MAX_LENGTH` (drop sources from the end if needed)
   - in the chat bubble, render `http`/`https` URLs in assistant messages as links that open in a new tab with `rel="noopener noreferrer"`; keep the rest as plain text
   - the message goes through the existing `ai-chat` feed, so every collaborator sees the sources

## Scope Limits

- don't change the research backend (spec 70)
- don't add Markdown rendering to chat bubbles beyond linking URLs
- don't show research notes themselves, only their sources

## Check When Done

- The toggle is remembered after reload and is off by default.
- A researched design shows "Researching best practices…" and then an assistant message ending with clickable sources.
- A design without research looks exactly as before.
- Messages with many sources stay within the chat length limit.
- `npm run build` passes.
