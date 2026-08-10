import type { Taxonomy, TaxonomyCategory, TaxonomyDiscovery } from "@ai-tech-stack/shared";
import type { GitHubClient, GitHubRepo } from "./github.js";

export type DiscoveredRepo = GitHubRepo & {
  topics: string[];
};

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function matchesExcludeName(name: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p).test(name);
    } catch {
      return name.toLowerCase().includes(p.toLowerCase());
    }
  });
}

export function passesFilters(
  repo: GitHubRepo,
  discovery: TaxonomyDiscovery,
  category: TaxonomyCategory,
  topics: string[],
): boolean {
  const minStars = category.minStars ?? discovery.minStars;
  if (repo.stargazers_count < minStars) return false;
  if (discovery.excludeForks && repo.fork) return false;
  if (discovery.excludeArchived && repo.archived) return false;
  if (daysSince(repo.pushed_at) > discovery.requireRecentPushDays) return false;

  const shortName = repo.full_name.split("/")[1] ?? repo.full_name;
  if (matchesExcludeName(shortName, discovery.excludeNamePatterns)) return false;
  if (matchesExcludeName(repo.full_name, discovery.excludeNamePatterns)) return false;

  const excludeTopics = new Set([
    ...(discovery.excludeTopics ?? []),
  ]);
  if (topics.some((t) => excludeTopics.has(t))) return false;

  return true;
}

export async function discoverByQueries(
  client: GitHubClient,
  discovery: TaxonomyDiscovery,
  opts: {
    label: string;
    queries: string[];
    topics?: string[];
    minStars?: number;
    maxCandidates: number;
  },
): Promise<DiscoveredRepo[]> {
  const category: TaxonomyCategory = {
    id: opts.label,
    layerId: "concepts",
    name: opts.label,
    description: opts.label,
    queries: opts.queries,
    topics: opts.topics,
    minStars: opts.minStars,
  };

  const byId = new Map<number, DiscoveredRepo>();

  for (const query of opts.queries) {
    console.log(`  search: ${query}`);
    const items = await client.searchRepositories(query, {
      perPage: 30,
      maxPages: 2,
    });

    for (const item of items) {
      if (byId.has(item.id)) continue;
      const topics =
        item.topics && item.topics.length > 0
          ? item.topics
          : await client.getRepoTopics(item.full_name);

      if (!passesFilters(item, discovery, category, topics)) continue;
      byId.set(item.id, { ...item, topics });
    }
  }

  const preferredTopics = new Set(opts.topics ?? []);
  const ranked = [...byId.values()].sort((a, b) => {
    const aHit = a.topics.filter((t) => preferredTopics.has(t)).length;
    const bHit = b.topics.filter((t) => preferredTopics.has(t)).length;
    if (bHit !== aHit) return bHit - aHit;
    return b.stargazers_count - a.stargazers_count;
  });

  return ranked.slice(0, opts.maxCandidates);
}

export async function discoverCategory(
  client: GitHubClient,
  taxonomy: Taxonomy,
  category: TaxonomyCategory,
): Promise<DiscoveredRepo[]> {
  return discoverByQueries(client, taxonomy.discovery, {
    label: category.id,
    queries: category.queries,
    topics: category.topics,
    minStars: category.minStars,
    maxCandidates: taxonomy.discovery.maxCandidatesPerCategory,
  });
}
