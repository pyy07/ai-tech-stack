import { resolveGitHubToken, tokenFingerprint } from "./env.js";
import { sleep } from "./paths.js";

export type GitHubRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  fork: boolean;
  pushed_at: string | null;
  topics?: string[];
  default_branch?: string;
};

type SearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
};

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token?: string) {
    const resolved = resolveGitHubToken(token);
    this.token = resolved.token;
    if (!this.token) {
      throw new Error(
        "GITHUB_TOKEN is required. Set env GITHUB_TOKEN, or put it in repo-root .env (see .env.example).",
      );
    }
    console.log(
      `[github] using token ${tokenFingerprint(this.token)} (source=${resolved.source})`,
    );
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-tech-stack-pipeline",
    };
  }

  async request<T>(path: string, init?: RequestInit, retries = 4): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, {
        ...init,
        headers: { ...this.headers(), ...(init?.headers ?? {}) },
      });

      if (res.status === 403 || res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset") || 0);
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const waitMs = retryAfter
          ? retryAfter * 1000
          : reset
            ? Math.max(reset * 1000 - Date.now(), 2000)
            : 5000 * (attempt + 1);
        console.warn(
          `[github] rate limited (${res.status}), waiting ${Math.ceil(waitMs / 1000)}s…`,
        );
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 401) {
          throw new Error(
            `GitHub API 401 Bad credentials (token ${tokenFingerprint(this.token)}). ` +
              `Token is present but rejected — revoke/recreate PAT, then set with:\n` +
              `  $env:GITHUB_TOKEN = 'ghp_...'   # PowerShell, single quotes, no spaces\n` +
              `or put GITHUB_TOKEN=ghp_... in repo-root .env\n` +
              `API body: ${body.slice(0, 300)}`,
          );
        }
        throw new Error(`GitHub API ${res.status} ${url}: ${body.slice(0, 400)}`);
      }

      return (await res.json()) as T;
    }

    throw new Error(`GitHub API failed after retries: ${url}`);
  }

  async verifyAuth(): Promise<{ login: string }> {
    return this.request<{ login: string }>("/user");
  }

  async searchRepositories(
    query: string,
    opts: { perPage?: number; maxPages?: number } = {},
  ): Promise<GitHubRepo[]> {
    const perPage = opts.perPage ?? 30;
    const maxPages = opts.maxPages ?? 2;
    const results: GitHubRepo[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const q = encodeURIComponent(query);
      const data = await this.request<SearchResponse>(
        `/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perPage}&page=${page}`,
      );
      results.push(...data.items);
      if (data.items.length < perPage) break;
      // Secondary rate limit courtesy
      await sleep(1200);
    }

    return results;
  }

  async getRepository(fullName: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${fullName}`);
  }

  /**
   * Approximate recent commit activity using participation stats (last 52 weeks).
   * Falls back to 0 if unavailable (202 / empty).
   */
  async getCommitActivityScore(fullName: string): Promise<number> {
    try {
      type Week = { total: number; week: number; days: number[] };
      const weeks = await this.request<Week[]>(
        `/repos/${fullName}/stats/commit_activity`,
      );
      if (!Array.isArray(weeks) || weeks.length === 0) return 0;
      const last13 = weeks.slice(-13);
      return last13.reduce((sum, w) => sum + (w.total || 0), 0);
    } catch {
      return 0;
    }
  }

  async getRepoTopics(fullName: string): Promise<string[]> {
    try {
      const data = await this.request<{ names: string[] }>(
        `/repos/${fullName}/topics`,
      );
      return data.names ?? [];
    } catch {
      return [];
    }
  }
}
