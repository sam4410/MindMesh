// Self-check for lib/project-repository.ts: node --import tsx --test lib/project-repository.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeRepositoryUrl, repositoryName } from "./project-repository";

test("accepts GitHub repository URLs and normalizes them", () => {
  assert.equal(normalizeRepositoryUrl("https://github.com/sam4410/MindMesh"), "https://github.com/sam4410/MindMesh");
  assert.equal(normalizeRepositoryUrl("  https://github.com/acme/api.service.git "), "https://github.com/acme/api.service");
  assert.equal(normalizeRepositoryUrl("https://github.com/my_org/repo-name/"), "https://github.com/my_org/repo-name");
  assert.equal(normalizeRepositoryUrl("https://github.com/a/my.gitrepo"), "https://github.com/a/my.gitrepo");
  assert.equal(repositoryName("https://github.com/sam4410/MindMesh"), "sam4410/MindMesh");
});

test("rejects anything else", () => {
  for (const value of [
    "",
    "github.com/a/b",
    "http://github.com/a/b",
    "https://gitlab.com/a/b",
    "https://github.com.evil.com/a/b",
    "https://github.com/a",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?tab=readme",
    "https://github.com/a/..",
    "https://github.com/../b",
    "https://github.com/a/b c",
    "javascript:alert(1)",
  ]) {
    assert.equal(normalizeRepositoryUrl(value), null, value);
  }
});
