import { z } from "zod";

import { designContextSchema, type DesignContextInput } from "@/lib/design-context";
import { normalizeRepositoryUrl } from "@/lib/project-repository";

const MAX_NAME_LENGTH = 100;
const MAX_ID_LENGTH = 120;
const MAX_REPOSITORY_URL_LENGTH = 300;
// Room-ID-safe: lowercase slug segments joined by single hyphens.
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// repositoryUrl: undefined leaves it unchanged, null clears it (spec 63).
export type ProjectInput =
  | { name?: string; id?: string; designContext?: DesignContextInput; repositoryUrl?: string | null }
  | { error: string };

// Reads optional `name`, `id`, `designContext` and `repositoryUrl` from a JSON request body. A missing or blank name
// yields no name so each route decides its own default; malformed input yields an error for a 400.
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

  const { name, id, designContext, repositoryUrl } = body as {
    name?: unknown;
    id?: unknown;
    designContext?: unknown;
    repositoryUrl?: unknown;
  };
  const input: { name?: string; id?: string; designContext?: DesignContextInput; repositoryUrl?: string | null } = {};

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

  if (designContext !== undefined && designContext !== null) {
    const parsed = designContextSchema.safeParse(designContext);
    if (!parsed.success) return { error: `designContext is invalid: ${z.prettifyError(parsed.error)}` };
    input.designContext = parsed.data;
  }

  if (repositoryUrl !== undefined) {
    // null or a blank string clears the link.
    if (repositoryUrl === null || (typeof repositoryUrl === "string" && repositoryUrl.trim() === "")) {
      input.repositoryUrl = null;
    } else {
      const normalized =
        typeof repositoryUrl === "string" && repositoryUrl.length <= MAX_REPOSITORY_URL_LENGTH
          ? normalizeRepositoryUrl(repositoryUrl)
          : null;
      if (!normalized) return { error: "repositoryUrl must look like https://github.com/owner/repo" };
      input.repositoryUrl = normalized;
    }
  }

  return input;
}
