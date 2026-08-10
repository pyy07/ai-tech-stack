import fs from "node:fs";
import path from "node:path";
import type {
  Concept,
  ConceptImplementation,
  ConceptsDocument,
  TaxonomyDiscovery,
} from "@ai-tech-stack/shared";
import type Database from "better-sqlite3";
import {
  getNearestStarsBefore,
  openDb,
  upsertMetricsDaily,
  upsertRepo,
} from "./db.js";
import { discoverByQueries } from "./discover.js";
import { guessPackages, resolveDownloads } from "./downloads.js";
import { GitHubClient } from "./github.js";
import { DATA_DIR, DB_PATH, SNAPSHOTS_DIR, sleep, todayUtc } from "./paths.js";
import { scoreRepos, type RawMetrics } from "./score.js";
import { loadTaxonomy } from "./taxonomy.js";

export const CONCEPTS_SOURCE_PATH = path.join(DATA_DIR, "concepts.json");
export const CONCEPTS_LATEST_PATH = path.join(
  SNAPSHOTS_DIR,
  "concepts-latest.json",
);

export function loadConceptsSource(
  filePath = CONCEPTS_SOURCE_PATH,
): ConceptsDocument {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as ConceptsDocument;
}

function mergeImplementations(
  seeds: ConceptImplementation[],
  auto: ConceptImplementation[],
  max: number,
): ConceptImplementation[] {
  const seen = new Set<string>();
  const out: ConceptImplementation[] = [];

  for (const seed of seeds) {
    const key = seed.repo.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seed);
    if (out.length >= max) return out;
  }

  for (const item of auto) {
    const key = item.repo.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }

  return out;
}

async function enrichAndScoreRepos(
  client: GitHubClient,
  db: Database.Database,
  date: string,
  repos: Awaited<ReturnType<typeof discoverByQueries>>,
  weights: ReturnType<typeof loadTaxonomy>["scoring"]["weights"],
  opts: { dryRun?: boolean; skipDownloads?: boolean },
): Promise<ConceptImplementation[]> {
  type Enriched = {
    full_name: string;
    url: string;
    description: string | null;
    language: string | null;
    homepage: string | null;
    id: number;
    stars: number;
    forks: number;
    open_issues: number;
    pushed_at: string | null;
    commit_activity: number;
    downloads: number | null;
    topics: string[];
  };

  const enriched: Enriched[] = [];

  for (const repo of repos) {
    let commitActivity = 0;
    try {
      commitActivity = await client.getCommitActivityScore(repo.full_name);
    } catch {
      commitActivity = 0;
    }

    const hints = guessPackages(repo.full_name, repo.language, repo.homepage);
    let downloads: number | null = null;
    if (!opts.skipDownloads) {
      const resolved = await resolveDownloads({
        language: repo.language,
        npmPackage: hints.npm,
        pypiPackage: hints.pypi,
      });
      downloads = resolved.downloads;
      await sleep(150);
    }

    const row: Enriched = {
      id: repo.id,
      full_name: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      language: repo.language,
      homepage: repo.homepage,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      pushed_at: repo.pushed_at,
      commit_activity: commitActivity,
      downloads,
      topics: repo.topics,
    };
    enriched.push(row);

    if (!opts.dryRun) {
      upsertRepo(db, {
        id: row.id,
        full_name: row.full_name,
        url: row.url,
        description: row.description,
        language: row.language,
        homepage: row.homepage,
        topics: row.topics,
        npm_package: hints.npm,
        pypi_package: hints.pypi,
      });
      upsertMetricsDaily(db, {
        repo_id: row.id,
        date,
        stars: row.stars,
        forks: row.forks,
        open_issues: row.open_issues,
        pushed_at: row.pushed_at,
        commit_activity: row.commit_activity,
        downloads: row.downloads,
      });
    }

    await sleep(200);
  }

  const rawMetrics: RawMetrics[] = enriched.map((e) => {
    let growth = 0;
    if (!opts.dryRun) {
      const before = getNearestStarsBefore(db, e.id, date, 40);
      growth = before == null ? 0 : Math.max(0, e.stars - before);
    }
    return {
      stars: e.stars,
      star_growth_30d: growth,
      forks: e.forks,
      commit_activity: e.commit_activity,
      downloads: e.downloads,
    };
  });

  const scored = scoreRepos(rawMetrics, weights);
  return enriched
    .map((e, i) => ({
      repo: e.full_name,
      url: e.url,
      note: e.description?.slice(0, 120) || "自动发现的代表实现",
      role: "auto" as const,
      stars: e.stars,
      score: scored[i]!.score,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export type UpdateConceptsOptions = {
  date?: string;
  dryRun?: boolean;
  skipDownloads?: boolean;
  limitConcepts?: number;
  client?: GitHubClient;
  db?: Database.Database;
  dbPath?: string;
  keepDbOpen?: boolean;
};

export async function updateConceptImplementations(
  opts: UpdateConceptsOptions = {},
): Promise<ConceptsDocument> {
  const date = opts.date ?? todayUtc();
  const source = loadConceptsSource();
  const taxonomy = loadTaxonomy();
  const discovery: TaxonomyDiscovery = taxonomy.discovery;
  const client = opts.client ?? new GitHubClient();
  const ownsDb = !opts.db;
  const db = opts.db ?? openDb(opts.dbPath ?? DB_PATH);

  const concepts = opts.limitConcepts
    ? source.concepts.slice(0, opts.limitConcepts)
    : source.concepts;

  console.log(
    `Concepts update date=${date} concepts=${concepts.length} dryRun=${!!opts.dryRun}`,
  );

  const updated: Concept[] = [];

  for (const concept of source.concepts) {
    const shouldProcess =
      !opts.limitConcepts ||
      concepts.some((c) => c.id === concept.id);

    if (!shouldProcess || !concept.queries?.length) {
      updated.push(concept);
      if (!concept.queries?.length) {
        console.log(`\n[${concept.id}] skip (no queries)`);
      }
      continue;
    }

    const max = concept.maxImplementations ?? 3;
    console.log(`\n[${concept.id}] ${concept.nameZh}`);

    const discovered = await discoverByQueries(client, discovery, {
      label: concept.id,
      queries: concept.queries,
      topics: concept.topics,
      minStars: concept.minStars,
      maxCandidates: Math.max(discovery.maxCandidatesPerCategory, max * 4),
    });
    console.log(`  candidates: ${discovered.length}`);

    const auto = await enrichAndScoreRepos(
      client,
      db,
      date,
      discovered,
      taxonomy.scoring.weights,
      opts,
    );

    const implementations = mergeImplementations(
      concept.implementations ?? [],
      auto,
      max,
    );

    updated.push({
      ...concept,
      implementations,
    });

    console.log(
      `  implementations: ${implementations.map((i) => i.repo).join(", ")}`,
    );
  }

  const doc: ConceptsDocument = {
    ...source,
    updatedAt: source.updatedAt,
    autoUpdatedAt: new Date().toISOString(),
    concepts: updated,
  };

  if (!opts.dryRun) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    fs.writeFileSync(
      CONCEPTS_LATEST_PATH,
      JSON.stringify(doc, null, 2) + "\n",
      "utf8",
    );
    console.log(`Wrote ${CONCEPTS_LATEST_PATH}`);
  } else {
    console.log("\n[dry-run] concepts implementations preview:");
    for (const c of updated) {
      console.log(
        `  ${c.id}: ${c.implementations.map((i) => i.repo).join(" | ") || "(none)"}`,
      );
    }
  }

  if (ownsDb && !opts.keepDbOpen) {
    db.close();
  }

  return doc;
}
