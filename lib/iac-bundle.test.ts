// Self-check for lib/iac-bundle.ts: node --import tsx --test lib/iac-bundle.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { strFromU8, unzipSync } from "fflate";

import {
  IAC_MAX_BYTES,
  IAC_MAX_FILES,
  allowedIacFormats,
  iacBlobPath,
  iacFilename,
  iacFilesError,
  iacFormatError,
  withReadme,
  zipIacFiles,
} from "@/lib/iac-bundle";

test("Azure gets Terraform or Bicep, AWS and GCP Terraform only, others nothing", () => {
  assert.deepEqual(allowedIacFormats("azure"), ["TERRAFORM", "BICEP"]);
  assert.deepEqual(allowedIacFormats("aws"), ["TERRAFORM"]);
  assert.deepEqual(allowedIacFormats("gcp"), ["TERRAFORM"]);
  for (const provider of ["agnostic", "on-prem", null, undefined, "", "toString"]) {
    assert.deepEqual(allowedIacFormats(provider), []);
  }
  assert.equal(iacFormatError("azure", "BICEP"), null);
  assert.equal(iacFormatError("aws", "TERRAFORM"), null);
  assert.equal(iacFormatError("gcp", "BICEP"), "Bicep is only available for Azure projects");
  assert.match(iacFormatError("on-prem", "TERRAFORM") ?? "", /^Choose a cloud provider/);
  assert.equal(iacBlobPath("p1", "b1"), "iac/p1/b1.zip");
  const day = new Date("2026-11-27T23:30:00Z");
  assert.equal(iacFilename("Chat Application Design", "TERRAFORM", day), "chat-application-design-terraform-2026-11-27.zip");
  assert.equal(iacFilename("🚀", "BICEP", day), "project-bicep-2026-11-27.zip");
});

test("accepts relative paths with the allowed extensions", () => {
  const files = [
    "main.tf",
    "variables.tf",
    "modules/redis_cache/main.tf",
    "environments/prod.tfvars.example",
    "main.bicep",
    "environments/dev.parameters.json",
    "README.md",
  ].map((path) => ({ path, content: "x" }));
  assert.equal(iacFilesError(files), null);
});

test("rejects unsafe paths, other file types, duplicates and oversized bundles", () => {
  const unsafe = ["/main.tf", "../main.tf", "modules/../../main.tf", "./main.tf", "a//main.tf", "a\\main.tf", "C:/main.tf", ".hidden.tf", "my file.tf", "modules/", ""];
  for (const path of unsafe) {
    assert.match(iacFilesError([{ path, content: "" }]) ?? "", /unsafe file path/, path);
  }
  for (const path of ["run.sh", "main.tf.bak", "terraform.tfvars", "deploy.ps1", "Makefile"]) {
    assert.match(iacFilesError([{ path, content: "" }]) ?? "", /file type that isn't allowed/, path);
  }
  assert.match(iacFilesError([{ path: "main.tf", content: "" }, { path: "MAIN.tf", content: "" }]) ?? "", /more than once/);
  assert.match(iacFilesError([]) ?? "", /no files/);
  const many = Array.from({ length: IAC_MAX_FILES + 1 }, (_, i) => ({ path: `f${i}.tf`, content: "" }));
  assert.match(iacFilesError(many) ?? "", /41 files; the limit is 40/);
  assert.equal(iacFilesError(many.slice(0, IAC_MAX_FILES)), null);
  assert.match(iacFilesError([{ path: "big.tf", content: "a".repeat(IAC_MAX_BYTES + 1) }]) ?? "", /the limit is 200 KB/);
  // Counted in UTF-8 bytes, not characters.
  assert.match(iacFilesError([{ path: "big.md", content: "é".repeat(IAC_MAX_BYTES / 2 + 1) }]) ?? "", /the limit is 200 KB/);
});

test("adds a README with the notes only when the model left it out, and zips the files at their paths", () => {
  const files = [{ path: "main.tf", content: 'resource "x" "y" {}' }];
  const withOne = withReadme(files, "TERRAFORM", ["Decide: Payment DB sku = GP_Gen5_2."]);
  assert.equal(withOne.length, 2);
  assert.match(withOne[1].content, /Decide: Payment DB sku = GP_Gen5_2\./);
  assert.match(withOne[1].content, /terraform plan/);
  const kept = [...files, { path: "readme.md", content: "mine" }];
  assert.equal(withReadme(kept, "BICEP", []), kept);

  const unzipped = unzipSync(zipIacFiles([{ path: "modules/db/main.tf", content: "é" }, ...withOne]));
  assert.deepEqual(Object.keys(unzipped).sort(), ["README.md", "main.tf", "modules/db/main.tf"]);
  assert.equal(strFromU8(unzipped["modules/db/main.tf"]), "é");
});
