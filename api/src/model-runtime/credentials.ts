import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { ModelRuntimeError, type ProviderConfig } from "./types.js";

const VERSION = "v1";

/** AES-256-GCM envelope used for provider credentials stored in Postgres. */
export function encryptCredential(plaintext: string, keyValue = credentialKey()): string {
  const key = decodeKey(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptCredential(envelope: string, keyValue = credentialKey()): string {
  const [version, ivText, tagText, encryptedText, ...extra] = envelope.split(":");
  if (version !== VERSION || !ivText || !tagText || !encryptedText || extra.length > 0) {
    throw new ModelRuntimeError("credential_format", "Provider credential envelope is invalid", 500);
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      decodeKey(keyValue),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ModelRuntimeError("credential_decrypt", "Provider credential could not be decrypted", 500);
  }
}

export function resolveProviderCredential(provider: ProviderConfig): string | undefined {
  if (provider.credential) return provider.credential;
  if (provider.credentialCiphertext) return decryptCredential(provider.credentialCiphertext);
  const envName = provider.config?.credentialEnv;
  if (typeof envName === "string" && envName) return process.env[envName]?.trim() || undefined;
  return undefined;
}

export function credentialHint(value: string): string {
  if (!value) return "";
  if (value.length < 9) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function credentialKey(): string {
  const value = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new ModelRuntimeError(
      "credential_key_missing",
      "CREDENTIAL_ENCRYPTION_KEY is required to manage provider credentials",
      500,
    );
  }
  return value;
}

function decodeKey(value: string): Buffer {
  let key: Buffer;
  if (/^[A-Fa-f0-9]{64}$/.test(value)) key = Buffer.from(value, "hex");
  else {
    try {
      key = Buffer.from(value, "base64");
    } catch {
      key = Buffer.alloc(0);
    }
  }
  if (key.length !== 32) {
    // Permit high-entropy passphrases without silently accepting a weak short
    // default. Operators should still supply a generated 32-byte key.
    if (Buffer.byteLength(value, "utf8") >= 32) {
      return createHash("sha256").update(value).digest();
    }
    throw new ModelRuntimeError(
      "credential_key_invalid",
      "CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (hex/base64 or 32+ character passphrase)",
      500,
    );
  }
  return key;
}

