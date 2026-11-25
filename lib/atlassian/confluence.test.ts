// Self-check for markdownToStorage: node --env-file=.env --import tsx --test lib/atlassian/confluence.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { markdownToStorage } from "./confluence";

test("headings, tables and void elements come out as XHTML", () => {
  const out = markdownToStorage("# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nline one  \nline two\n\n---\n");
  assert.match(out, /<h1>Title<\/h1>/);
  assert.match(out, /<table>[\s\S]*<th>A<\/th>[\s\S]*<td>2<\/td>[\s\S]*<\/table>/);
  assert.match(out, /<br\/>/);
  assert.match(out, /<hr\/>/);
  assert.doesNotMatch(out, /<(br|hr)>/);
});

test("fenced code becomes the code macro with its text kept exactly", () => {
  const out = markdownToStorage("```TypeScript\nif (a < b && c) {}\n// ]]> end\n```\n");
  assert.match(out, /<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">typescript<\/ac:parameter>/);
  assert.ok(out.includes("<![CDATA[if (a < b && c) {}\n// ]]]]><![CDATA[> end]]>"));
});

test("bare ampersands and raw HTML are escaped, entities are kept", () => {
  const out = markdownToStorage("Q&A &amp; more\n\n<div onclick=x>hi</div>\n");
  assert.match(out, /Q&amp;A &amp; more/);
  assert.doesNotMatch(out, /<div/);
  assert.match(out, /&lt;div onclick=x&gt;/);
});
