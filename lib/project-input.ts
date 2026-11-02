const MAX_NAME_LENGTH = 100;
const MAX_ID_LENGTH = 120;
// Room-ID-safe: lowercase slug segments joined by single hyphens.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ProjectInput = { name?: string; id?: string } | { error: string };

// Reads optional `name` and `id` from a JSON request body. A missing or blank name yields no
// name so each route decides its own default; malformed input yields an error for a 400.
export async function readProjectInput(req: Request): Promise<ProjectInput> {
  const text = await req.text();
  if (text.trim() === "") return {};

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: "Request body must be valid JSON" };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const { name, id } = body as { name?: unknown; id?: unknown };
  const input: { name?: string; id?: string } = {};

  if (name !== undefined && name !== null) {
    if (typeof name !== "string") return { error: "name must be a string" };
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
      return { error: `name must be at most ${MAX_NAME_LENGTH} characters` };
    }
    if (trimmed) input.name = trimmed;
  }

  if (id !== undefined && id !== null) {
    if (typeof id !== "string" || id.length > MAX_ID_LENGTH || !ID_PATTERN.test(id)) {
      return { error: "id must be a lowercase slug of letters, digits and hyphens" };
    }
    input.id = id;
  }

  return input;
}
