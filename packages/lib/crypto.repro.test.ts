import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { symmetricDecrypt, symmetricEncrypt } from "./crypto";

describe("crypto key encoding bug (CAL-2901)", () => {
  const plaintext = "test-secret-value";

  it("round-trips with a properly-generated base64-encoded 32-byte key", () => {
    // 32 random bytes encoded as base64 → 44-char string, what `openssl rand -base64 32` produces.
    const key = crypto.randomBytes(32).toString("base64");
    expect(key).toHaveLength(44);

    let ciphertext = "";
    expect(() => {
      ciphertext = symmetricEncrypt(plaintext, key);
    }).not.toThrow();
    expect(symmetricDecrypt(ciphertext, key)).toBe(plaintext);
  });

  it("round-trips with a legacy 32-char key without throwing 'Invalid key length'", () => {
    // Legacy keys were generated via `openssl rand -base64 24` → 32-char string,
    // which does NOT decode to 32 bytes under base64 and must fall back to latin1.
    const key = crypto.randomBytes(24).toString("base64");
    expect(key).toHaveLength(32);

    let ciphertext = "";
    expect(() => {
      ciphertext = symmetricEncrypt(plaintext, key);
    }).not.toThrow();
    expect(symmetricDecrypt(ciphertext, key)).toBe(plaintext);
  });

  it("round-trips with a deterministic 44-char base64 32-byte key", () => {
    const key = Buffer.alloc(32, 1).toString("base64");
    expect(key).toHaveLength(44);

    const ciphertext = symmetricEncrypt(plaintext, key);
    expect(symmetricDecrypt(ciphertext, key)).toBe(plaintext);
  });
});
