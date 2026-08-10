import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./paths.js";

export type TokenSource =
  | "explicit"
  | "env:GITHUB_TOKEN"
  | "env:GH_TOKEN"
  | "dotenv"
  | "none";

/** Parse simple KEY=VALUE pairs from a .env file. */
export function readDotEnv(
  filePath = path.join(ROOT_DIR, ".env"),
): Record<string, string> {
  const values: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return values;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Normalize PAT: trim, strip wrapping quotes, remove accidental "Bearer " prefix. */
export function normalizeToken(raw: string | undefined | null): string {
  if (!raw) return "";
  let t = raw.trim().replace(/^\uFEFF/, "");
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, "").trim();
  }
  return t;
}

export function tokenFingerprint(token: string): string {
  if (!token) return "(empty)";
  const prefix = token.slice(0, 7);
  return `${prefix}… length=${token.length}`;
}

/**
 * Resolve GitHub token.
 * Prefer repo-root .env over shell env when both exist and differ —
 * stale shell GITHUB_TOKEN is a common cause of 401 after rotating PATs.
 */
export function resolveGitHubToken(explicit?: string): {
  token: string;
  source: TokenSource;
} {
  const fileToken = normalizeToken(readDotEnv().GITHUB_TOKEN);
  const envGithub = normalizeToken(process.env.GITHUB_TOKEN);
  const envGh = normalizeToken(process.env.GH_TOKEN);
  const explicitNorm = normalizeToken(explicit);

  if (explicitNorm) return { token: explicitNorm, source: "explicit" };

  if (fileToken) {
    if (envGithub && envGithub !== fileToken) {
      console.warn(
        `[github] ignoring shell GITHUB_TOKEN (${tokenFingerprint(envGithub)}); using .env (${tokenFingerprint(fileToken)})`,
      );
    }
    return { token: fileToken, source: "dotenv" };
  }

  if (envGithub) return { token: envGithub, source: "env:GITHUB_TOKEN" };
  if (envGh) return { token: envGh, source: "env:GH_TOKEN" };
  return { token: "", source: "none" };
}
