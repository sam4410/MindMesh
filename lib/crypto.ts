import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts integration secrets (spec 60) with AES-256-GCM. Server-only.
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

// Read on each call so a missing key fails the request that needs it, not the whole build.
function getKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set (generate one with `openssl rand -base64 32`)");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`INTEGRATIONS_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

// Returns "base64(iv).base64(tag).base64(ciphertext)" with a random 12-byte IV.
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64")).join(".");
}

// Throws when the value was changed, was encrypted with another key, or isn't in the format above.
export function decryptSecret(value: string): string {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Encrypted value is malformed");
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64"));
  if (iv.length !== IV_BYTES) throw new Error("Encrypted value is malformed");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
