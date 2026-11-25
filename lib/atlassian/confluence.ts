import { Marked } from "marked";

import { atlassianAuthHeader, type AtlassianConnection } from "@/lib/integrations";

// Confluence publishing (spec 61): Markdown → storage format, and the two Cloud REST v2 calls.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeXml = (text: string) => text.replace(/[&<>"]/g, (char) => ESCAPES[char]);

// "]]>" would end the CDATA section early, so it's split across two sections.
const cdata = (text: string) => `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

const markdown = new Marked({
  gfm: true,
  renderer: {
    // Fenced code becomes Confluence's code macro, which keeps the text exactly and highlights it.
    code({ text, lang }) {
      const language = (lang ?? "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9+#-]/g, "");
      return [
        '<ac:structured-macro ac:name="code">',
        language ? `<ac:parameter ac:name="language">${language}</ac:parameter>` : "",
        `<ac:plain-text-body>${cdata(text)}</ac:plain-text-body>`,
        "</ac:structured-macro>\n",
      ].join("");
    },
    // Raw HTML in the Markdown is shown as text: storage format rejects malformed or unknown markup.
    html({ text }) {
      return escapeXml(text);
    },
  },
});

// Void elements marked writes in HTML style; storage format is XHTML, so they must self-close.
const VOID_ELEMENTS = /<(br|hr|img|input)(\s[^<>]*?)?\s*\/?>/gi;
// A "&" that doesn't start an entity (named, decimal or hex) isn't valid XHTML.
const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g;

// Markdown (GFM, with tables) → Confluence storage format (XHTML).
export function markdownToStorage(source: string) {
  const html = markdown.parse(source, { async: false }) as string;
  // Code macro bodies are CDATA, where "&" must stay as it is; only the rest is made XHTML-safe.
  return html
    .split(/(<!\[CDATA\[[\s\S]*?]]>)/)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(VOID_ELEMENTS, (_, tag, attrs = "") => `<${tag}${attrs}/>`).replace(BARE_AMPERSAND, "&amp;")
    )
    .join("");
}

const TIMEOUT_MS = 10_000;

// A failed Confluence call, with the message the user sees and the HTTP status the route returns.
export class ConfluenceError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const REJECTED = "Atlassian rejected the request. Check the connection and space permissions.";

async function confluenceFetch(connection: AtlassianConnection, path: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(`${connection.siteUrl}/wiki/api/v2${path}`, {
      ...init,
      headers: {
        authorization: atlassianAuthHeader(connection.email, connection.apiToken),
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
  } catch (err) {
    console.warn("Confluence request failed", { path: path.split("?")[0], error: err instanceof Error ? err.name : "unknown" });
    throw new ConfluenceError("Couldn't reach Confluence. Try again.", 502);
  }
  if (res.status === 401 || res.status === 403) throw new ConfluenceError(REJECTED, 400);
  return res;
}

// The space's ID for its key; a 400 when the space doesn't exist or isn't visible to the account.
export async function findSpaceId(connection: AtlassianConnection, spaceKey: string) {
  const res = await confluenceFetch(connection, `/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`);
  if (!res.ok) {
    console.warn("Confluence space lookup failed", { status: res.status });
    throw new ConfluenceError("Couldn't look up that Confluence space. Try again.", 502);
  }
  const body = (await res.json()) as { results?: { id: string; key: string }[] };
  const space = body.results?.find((result) => result.key.toLowerCase() === spaceKey.toLowerCase());
  if (!space) throw new ConfluenceError(`Confluence space "${spaceKey}" wasn't found.`, 400);
  return space.id;
}

interface CreatedPage {
  id: string;
  _links?: { webui?: string; base?: string };
}

// Titles are unique within a space, so a republish adds " (2)", " (3)", … instead of failing.
const MAX_TITLE_ATTEMPTS = 5;

// Creates a page and returns its URL.
export async function createPage(
  connection: AtlassianConnection,
  page: { spaceId: string; title: string; parentId?: string; storage: string }
) {
  for (let attempt = 1; attempt <= MAX_TITLE_ATTEMPTS; attempt++) {
    const title = attempt === 1 ? page.title : `${page.title} (${attempt})`;
    const res = await confluenceFetch(connection, "/pages", {
      method: "POST",
      body: JSON.stringify({
        spaceId: page.spaceId,
        status: "current",
        title,
        ...(page.parentId ? { parentId: page.parentId } : {}),
        body: { representation: "storage", value: page.storage },
      }),
    });
    if (res.ok) {
      const created = (await res.json()) as CreatedPage;
      const base = created._links?.base ?? `${connection.siteUrl}/wiki`;
      return created._links?.webui ? `${base}${created._links.webui}` : `${base}/pages/viewpage.action?pageId=${created.id}`;
    }
    const detail = await res.text().catch(() => "");
    if (res.status === 400 && /title/i.test(detail) && /exist/i.test(detail)) continue;
    console.warn("Confluence page creation failed", { status: res.status });
    if (res.status === 404 && page.parentId) {
      throw new ConfluenceError("The parent page wasn't found in that space.", 400);
    }
    if (res.status === 400) {
      throw new ConfluenceError(page.parentId ? "Confluence refused the page. Check the parent page ID." : "Confluence refused the page.", 400);
    }
    throw new ConfluenceError("Couldn't publish to Confluence. Try again.", 502);
  }
  throw new ConfluenceError("A page with this title already exists several times in that space.", 400);
}
