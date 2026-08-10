import fs from "node:fs";
import path from "node:path";
import type {
  Snapshot,
  SnapshotCategory,
  SnapshotRankedRepo,
  Taxonomy,
} from "@ai-tech-stack/shared";
import {
  getNearestStarsBefore,
  getPreviousRankings,
  openDb,
  replaceCategoryCandidates,
  replaceCategoryRankings,
  upsertMetricsDaily,
  upsertRepo,
} from "./db.js";
import { discoverCategory } from "./discover.js";
import { guessPackages, resolveDownloads } from "./downloads.js";
import { writeSnapshots } from "./export.js";
import { GitHubClient } from "./github.js";
import { DB_PATH, SNAPSHOTS_DIR, sleep, todayUtc } from "./paths.js";
import { scoreRepos, type RawMetrics } from "./score.js";
import { loadTaxonomy } from "./taxonomy.js";

export type RunOptions = {
  date?: string;
  dryRun?: boolean;
  limitCategories?: number;
  dbPath?: string;
  skipDownloads?: boolean;
};

export async function runPipeline(opts: RunOptions = {}): Promise<Snapshot> {
  const date = opts.date ?? todayUtc();
  const taxonomy = loadTaxonomy();
  const client = new GitHubClient();
  const db = openDb(opts.dbPath ?? DB_PATH);

  const categories = opts.limitCategories
    ? taxonomy.categories.slice(0, opts.limitCategories)
    : taxonomy.categories;

  console.log(
    `Pipeline run date=${date} categories=${categories.length} dryRun=${!!opts.dryRun}`,
  );

  const snapshotCategories: SnapshotCategory[] = [];

  for (const category of categories) {
    console.log(`\n[${category.id}] ${category.name}`);
    const discovered = await discoverCategory(client, taxonomy, category);
    console.log(`  candidates: ${discovered.length}`);

    type Enriched = {
      id: number;
      full_name: string;
      url: string;
      description: string | null;
      language: string | null;
      homepage: string | null;
      stars: number;
      forks: number;
      open_issues: number;
      pushed_at: string | null;
      commit_activity: number;
      downloads: number | null;
      topics: string[];
      npm_package: string | null;
      pypi_package: string | null;
    };

    const enriched: Enriched[] = [];

    for (const repo of discovered) {
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
        npm_package: hints.npm,
        pypi_package: hints.pypi,
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
          npm_package: row.npm_package,
          pypi_package: row.pypi_package,
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

    if (!opts.dryRun) {
      replaceCategoryCandidates(
        db,
        date,
        category.id,
        enriched.map((e) => e.id),
      );
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

    const scored = scoreRepos(rawMetrics, taxonomy.scoring.weights);
    const ranked = enriched
      .map((e, i) => ({
        repo: e,
        score: scored[i]!.score,
        breakdown: scored[i]!.breakdown,
      }))
      .sort((a, b) => b.score - a.score);

    const prevRanks = opts.dryRun
      ? new Map<number, number>()
      : getPreviousRankings(db, category.id, date);

    if (!opts.dryRun) {
      replaceCategoryRankings(
        db,
        date,
        category.id,
        ranked.map((r, idx) => ({
          repo_id: r.repo.id,
          rank: idx + 1,
          score: r.score,
          breakdown: r.breakdown,
        })),
      );
    }

    const topN: SnapshotRankedRepo[] = ranked.slice(0, 5).map((r, idx) => {
      const prev = prevRanks.get(r.repo.id);
      const rank = idx + 1;
      return {
        fullName: r.repo.full_name,
        url: r.repo.url,
        description: r.repo.description,
        language: r.repo.language,
        stars: r.repo.stars,
        score: r.score,
        rank,
        rankChange: prev == null ? null : prev - rank,
        breakdown: r.breakdown,
      };
    });

    const winner = topN[0]
      ? {
          fullName: topN[0].fullName,
          url: topN[0].url,
          description: topN[0].description,
          language: topN[0].language,
          stars: topN[0].stars,
          score: topN[0].score,
          rankChange: topN[0].rankChange,
          breakdown: topN[0].breakdown,
        }
      : null;

    snapshotCategories.push({
      id: category.id,
      layerId: category.layerId,
      name: category.name,
      description: category.description,
      winner,
      topN,
    });
  }

  const snapshot: Snapshot = {
    updatedAt: new Date().toISOString(),
    layers: taxonomy.layers.map((l) => ({
      id: l.id,
      name: l.name,
      nameEn: l.nameEn,
      order: l.order,
    })),
    categories: mergeCategories(taxonomy, snapshotCategories, opts.limitCategories),
  };

  if (!opts.dryRun) {
    writeSnapshots(snapshot, date);
  } else {
    console.log("\n[dry-run] categories processed:", snapshotCategories.length);
    for (const c of snapshotCategories) {
      console.log(
        `  ${c.id}: ${c.winner?.fullName ?? "(none)"} score=${c.winner?.score ?? "-"}`,
      );
    }
  }

  db.close();
  return snapshot;
}

function mergeCategories(
  taxonomy: Taxonomy,
  processed: SnapshotCategory[],
  limit?: number,
): SnapshotCategory[] {
  if (!limit) return processed;

  const latestPath = path.join(SNAPSHOTS_DIR, "latest.json");
  const byId = new Map<string, SnapshotCategory>();

  if (fs.existsSync(latestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(latestPath, "utf8")) as Snapshot;
      for (const c of existing.categories) byId.set(c.id, c);
    } catch {
      // ignore corrupt latest
    }
  }

  for (const c of processed) byId.set(c.id, c);

  return taxonomy.categories.map(
    (tc) =>
      byId.get(tc.id) ?? {
        id: tc.id,
        layerId: tc.layerId,
        name: tc.name,
        description: tc.description,
        winner: null,
        topN: [],
      },
  );
}
