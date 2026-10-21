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
      // Support Python-style (?i) / (?i:...) so taxonomy YAML stays portable
      let source = p;
      let flags = "";
      if (source.startsWith("(?i)")) {
        flags = "i";
        source = source.slice(4);
      } else {
        const inline = source.match(/^\(\?i:(.*)\)$/s);
        if (inline) {
          flags = "i";
          source = inline[1]!;
        }
      }
      return new RegExp(source, flags).test(name);
    } catch {
      return name.toLowerCase().includes(p.toLowerCase());
    }
  });
}

function categoryExcludePatterns(category: TaxonomyCategory): string[] {
  return category.excludeNamePatterns ?? [];
}

export function passesFilters(
  repo: GitHubRepo,
  discovery: TaxonomyDiscovery,
  category: TaxonomyCategory,
  topics: string[],
  opts: { relaxMinStars?: boolean } = {},
): boolean {
  const minStars = category.minStars ?? discovery.minStars;
  if (!opts.relaxMinStars && repo.stargazers_count < minStars) return false;
  if (discovery.excludeForks && repo.fork) return false;
  if (discovery.excludeArchived && repo.archived) return false;
  if (daysSince(repo.pushed_at) > discovery.requireRecentPushDays) return false;

  const shortName = repo.full_name.split("/")[1] ?? repo.full_name;
  const namePatterns = [
    ...(discovery.excludeNamePatterns ?? []),
    ...categoryExcludePatterns(category),
  ];
  if (matchesExcludeName(shortName, namePatterns)) return false;
  if (matchesExcludeName(repo.full_name, namePatterns)) return false;

  const excludeTopics = new Set([...(discovery.excludeTopics ?? [])]);
  if (topics.some((t) => excludeTopics.has(t))) return false;

  return true;
}

async function enrichTopics(
  client: GitHubClient,
  item: GitHubRepo,
): Promise<string[]> {
  if (item.topics && item.topics.length > 0) return item.topics;
  return client.getRepoTopics(item.full_name);
}

export async function discoverByQueries(
  client: GitHubClient,
  discovery: TaxonomyDiscovery,
  opts: {
    label: string;
    queries: string[];
    topics?: string[];
    minStars?: number;
    seeds?: string[];
    excludeNamePatterns?: string[];
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
    seeds: opts.seeds,
    excludeNamePatterns: opts.excludeNamePatterns,
  };

  const byId = new Map<number, DiscoveredRepo>();

  for (const seed of opts.seeds ?? []) {
    const fullName = seed.trim();
    if (!fullName.includes("/")) continue;
    try {
      console.log(`  seed: ${fullName}`);
      const item = await client.getRepository(fullName);
      const topics = await enrichTopics(client, item);
      // Seeds bypass star floor but still respect fork/archive/recency/name excludes
      if (!passesFilters(item, discovery, category, topics, { relaxMinStars: true })) {
        console.warn(`  seed skipped by filters: ${fullName}`);
        continue;
      }
      byId.set(item.id, { ...item, topics });
    } catch (err) {
      console.warn(
        `  seed failed: ${fullName} (${err instanceof Error ? err.message : err})`,
      );
    }
  }

  for (const query of opts.queries) {
    console.log(`  search: ${query}`);
    const items = await client.searchRepositories(query, {
      perPage: 30,
      maxPages: 2,
    });

    for (const item of items) {
      if (byId.has(item.id)) continue;
      const topics = await enrichTopics(client, item);

      if (!passesFilters(item, discovery, category, topics)) continue;
      byId.set(item.id, { ...item, topics });
    }
  }

  const preferredTopics = new Set(opts.topics ?? []);
  const seedSet = new Set((opts.seeds ?? []).map((s) => s.toLowerCase()));
  const ranked = [...byId.values()].sort((a, b) => {
    const aSeed = seedSet.has(a.full_name.toLowerCase()) ? 1 : 0;
    const bSeed = seedSet.has(b.full_name.toLowerCase()) ? 1 : 0;
    if (bSeed !== aSeed) return bSeed - aSeed;
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
    seeds: category.seeds,
    excludeNamePatterns: category.excludeNamePatterns,
    maxCandidates: taxonomy.discovery.maxCandidatesPerCategory,
  });
}
