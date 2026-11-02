export interface Project {
  id: string;
  name: string;
  slug: string;
  isOwner: boolean;
}

// shortcut: mock data until the projects API exists (Feature 04 forbids API calls and persistence).
export const mockProjects: Project[] = [
  { id: "p1", name: "Payments Platform", slug: "payments-platform", isOwner: true },
  { id: "p2", name: "Realtime Chat", slug: "realtime-chat", isOwner: true },
  { id: "p3", name: "Media Pipeline", slug: "media-pipeline", isOwner: false },
];

export function toSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
