// Self-check for lib/crypto.ts: node --import tsx --test lib/crypto.test.ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { decryptSecret, encryptSecret } from "./crypto";

// A throwaway key for this run only.
process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");

test("round trip returns the original text", () => {
  const secret = "ATATT3x-example-token_ünïcødé";
  const encrypted = encryptSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.ok(!encrypted.includes(secret));
  assert.equal(encrypted.split(".").length, 3);
  assert.equal(decryptSecret(encrypted), secret);
});

test("each encryption uses a fresh IV", () => {
  assert.notEqual(encryptSecret("same"), encryptSecret("same"));
});

test("a tampered ciphertext fails", () => {
  const [iv, tag, ciphertext] = encryptSecret("token").split(".");
  const bytes = Buffer.from(ciphertext, "base64");
  bytes[0] ^= 1;
  assert.throws(() => decryptSecret([iv, tag, bytes.toString("base64")].join(".")));
});

test("a tampered tag fails", () => {
  const [iv, tag, ciphertext] = encryptSecret("token").split(".");
  const bytes = Buffer.from(tag, "base64");
  bytes[0] ^= 1;
  assert.throws(() => decryptSecret([iv, bytes.toString("base64"), ciphertext].join(".")));
});

test("a different key fails", () => {
  const encrypted = encryptSecret("token");
  const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    assert.throws(() => decryptSecret(encrypted));
  } finally {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = original;
  }
});

test("a malformed value fails", () => {
  assert.throws(() => decryptSecret("not-encrypted"));
});

test("a missing key names the variable", () => {
  const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptSecret("token"), /INTEGRATIONS_ENCRYPTION_KEY is not set/);
  } finally {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = original;
  }
});
