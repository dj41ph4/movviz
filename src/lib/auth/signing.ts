/**
 * HMAC-SHA256 signing for session tokens.
 * Uses Web Crypto API — works in both Edge (middleware) and Node.js runtimes.
 *
 * The signing key comes from:
 *   1. MOVVIZ_SESSION_SECRET env var (recommended, works in both runtimes)
 *   2. Auto-generated, stored in {configDir}/.session-secret (Node.js only)
 */

const ALGO = { name: "HMAC", hash: "SHA-256" };
const KEY_BYTES = 32;
const ENV_KEY = "MOVVIZ_SESSION_SECRET";

export function isSigningKeyConfigured(): boolean {
  return !!process.env[ENV_KEY];
}

export function getRawSigningKey(): string | null {
  return process.env[ENV_KEY] ?? null;
}

export function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), ALGO, false, ["sign", "verify"]);
}

export function sign(token: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle.sign(ALGO, key, enc.encode(token)).then((buf) => {
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

export function verify(token: string, signature: string, key: CryptoKey): Promise<boolean> {
  const enc = new TextEncoder();
  const sigBytes = new Uint8Array(
    signature.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
  );
  return crypto.subtle.verify(ALGO, key, sigBytes, enc.encode(token));
}
