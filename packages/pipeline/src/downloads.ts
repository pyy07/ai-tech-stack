import { sleep } from "./paths.js";

const NPM_LANGS = new Set([
  "TypeScript",
  "JavaScript",
  "Vue",
  "Svelte",
  "CSS",
  "HTML",
]);

const PYPI_LANGS = new Set(["Python", "Jupyter Notebook"]);

export type PackageHints = {
  npm: string | null;
  pypi: string | null;
};

/** Heuristic package names from repo full_name / homepage. */
export function guessPackages(
  fullName: string,
  language: string | null,
  homepage: string | null,
): PackageHints {
  const repo = fullName.split("/")[1] ?? fullName;
  const normalized = repo
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\.js$/, "");

  let npm: string | null = null;
  let pypi: string | null = null;

  if (!language || NPM_LANGS.has(language)) {
    npm = normalized;
    if (homepage?.includes("npmjs.com/package/")) {
      const m = homepage.match(/npmjs\.com\/package\/(@?[\w.-]+(?:\/[\w.-]+)?)/);
      if (m) npm = m[1];
    }
  }

  if (!language || PYPI_LANGS.has(language)) {
    pypi = repo.toLowerCase().replace(/-/g, "_");
    // Also try hyphenated form
  }

  return { npm, pypi };
}

export async function fetchNpmWeeklyDownloads(
  packageName: string,
): Promise<number | null> {
  try {
    const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ai-tech-stack-pipeline" },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { downloads?: number };
    return typeof data.downloads === "number" ? data.downloads : null;
  } catch {
    return null;
  }
}

export async function fetchPypiRecentDownloads(
  packageName: string,
): Promise<number | null> {
  // pypistats.org last_month; fall back to null on failure
  const candidates = [
    packageName,
    packageName.replace(/_/g, "-"),
    packageName.replace(/-/g, "_"),
  ];
  const unique = [...new Set(candidates)];

  for (const name of unique) {
    try {
      const url = `https://pypistats.org/api/packages/${encodeURIComponent(name)}/recent`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ai-tech-stack-pipeline" },
      });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: { last_month?: number; last_week?: number };
      };
      const monthly = data.data?.last_month;
      if (typeof monthly === "number") return monthly;
      const weekly = data.data?.last_week;
      if (typeof weekly === "number") return weekly * 4;
    } catch {
      // try next candidate
    }
    await sleep(200);
  }
  return null;
}

export async function resolveDownloads(opts: {
  language: string | null;
  npmPackage: string | null;
  pypiPackage: string | null;
}): Promise<{ downloads: number | null; source: "npm" | "pypi" | null; packageName: string | null }> {
  const { language, npmPackage, pypiPackage } = opts;

  if (language && NPM_LANGS.has(language) && npmPackage) {
    const d = await fetchNpmWeeklyDownloads(npmPackage);
    if (d != null) return { downloads: d, source: "npm", packageName: npmPackage };
  }

  if (language && PYPI_LANGS.has(language) && pypiPackage) {
    const d = await fetchPypiRecentDownloads(pypiPackage);
    if (d != null) return { downloads: d, source: "pypi", packageName: pypiPackage };
  }

  // Try both if language unknown
  if (!language || (!NPM_LANGS.has(language) && !PYPI_LANGS.has(language))) {
    if (npmPackage) {
      const d = await fetchNpmWeeklyDownloads(npmPackage);
      if (d != null) return { downloads: d, source: "npm", packageName: npmPackage };
    }
    if (pypiPackage) {
      const d = await fetchPypiRecentDownloads(pypiPackage);
      if (d != null) return { downloads: d, source: "pypi", packageName: pypiPackage };
    }
  }

  // Cross-try: Python repos sometimes publish to npm under different names — skip
  if (NPM_LANGS.has(language ?? "") === false && pypiPackage) {
    const d = await fetchPypiRecentDownloads(pypiPackage);
    if (d != null) return { downloads: d, source: "pypi", packageName: pypiPackage };
  }

  return { downloads: null, source: null, packageName: null };
}
