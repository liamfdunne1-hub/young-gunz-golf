import { createHash, timingSafeEqual } from "node:crypto";

export const DEFAULT_SETH_PASSCODE = "GUNZ26";

export function hashPasscode(code: string): string {
  return createHash("sha256").update(`yg-seth:${code.trim().toUpperCase()}`).digest("hex");
}

export function passcodeMatches(code: string, storedHash: string | null): boolean {
  const got = Buffer.from(hashPasscode(code), "hex");
  const expected = Buffer.from(storedHash && storedHash.length ? storedHash : hashPasscode(DEFAULT_SETH_PASSCODE), "hex");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
