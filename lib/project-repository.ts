// A project's GitHub repository link (spec 63): https://github.com/{owner}/{repo}, where owner and
// repo hold letters, digits, ".", "_" and "-". A trailing ".git" (and "/") is dropped.
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;
// Dots alone ("." or "..") would make the link point somewhere else on GitHub.
const ONLY_DOTS = /^\.+$/;

// The normalized URL, or null when the value isn't a GitHub repository URL.
export function normalizeRepositoryUrl(value: string): string | null {
  const match = GITHUB_REPOSITORY.exec(value.trim());
  if (!match) return null;
  const [, owner, repo] = match;
  if (ONLY_DOTS.test(owner) || ONLY_DOTS.test(repo)) return null;
  return `https://github.com/${owner}/${repo}`;
}

// "owner/repo", for labels.
export function repositoryName(url: string) {
  return url.replace(/^https:\/\/github\.com\//, "");
}
