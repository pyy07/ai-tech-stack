import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH } from "./paths.js";

export type RepoRow = {
  id: number;
  full_name: string;
  url: string;
  description: string | null;
  language: string | null;
  homepage: string | null;
  topics_json: string;
  npm_package: string | null;
  pypi_package: string | null;
};

export type MetricsDailyRow = {
  repo_id: number;
  date: string;
  stars: number;
  forks: number;
  open_issues: number;
  pushed_at: string | null;
  commit_activity: number;
  downloads: number | null;
};

export function openDb(dbPath = DB_PATH): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      description TEXT,
      language TEXT,
      homepage TEXT,
      topics_json TEXT NOT NULL DEFAULT '[]',
      npm_package TEXT,
      pypi_package TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics_daily (
      repo_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      stars INTEGER NOT NULL,
      forks INTEGER NOT NULL,
      open_issues INTEGER NOT NULL,
      pushed_at TEXT,
      commit_activity REAL NOT NULL DEFAULT 0,
      downloads INTEGER,
      PRIMARY KEY (repo_id, date),
      FOREIGN KEY (repo_id) REFERENCES repos(id)
    );

    CREATE TABLE IF NOT EXISTS category_candidates (
      date TEXT NOT NULL,
      category_id TEXT NOT NULL,
      repo_id INTEGER NOT NULL,
      PRIMARY KEY (date, category_id, repo_id),
      FOREIGN KEY (repo_id) REFERENCES repos(id)
    );

    CREATE TABLE IF NOT EXISTS category_rankings (
      date TEXT NOT NULL,
      category_id TEXT NOT NULL,
      repo_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      score_breakdown_json TEXT NOT NULL,
      PRIMARY KEY (date, category_id, repo_id),
      FOREIGN KEY (repo_id) REFERENCES repos(id)
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date);
    CREATE INDEX IF NOT EXISTS idx_rankings_date_cat ON category_rankings(date, category_id);
  `);
}

export function upsertRepo(
  db: Database.Database,
  repo: {
    id: number;
    full_name: string;
    url: string;
    description: string | null;
    language: string | null;
    homepage: string | null;
    topics: string[];
    npm_package?: string | null;
    pypi_package?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO repos (id, full_name, url, description, language, homepage, topics_json, npm_package, pypi_package, updated_at)
     VALUES (@id, @full_name, @url, @description, @language, @homepage, @topics_json, @npm_package, @pypi_package, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       full_name=excluded.full_name,
       url=excluded.url,
       description=excluded.description,
       language=excluded.language,
       homepage=excluded.homepage,
       topics_json=excluded.topics_json,
       npm_package=COALESCE(excluded.npm_package, repos.npm_package),
       pypi_package=COALESCE(excluded.pypi_package, repos.pypi_package),
       updated_at=excluded.updated_at`,
  ).run({
    id: repo.id,
    full_name: repo.full_name,
    url: repo.url,
    description: repo.description,
    language: repo.language,
    homepage: repo.homepage,
    topics_json: JSON.stringify(repo.topics),
    npm_package: repo.npm_package ?? null,
    pypi_package: repo.pypi_package ?? null,
    updated_at: new Date().toISOString(),
  });
}

export function upsertMetricsDaily(db: Database.Database, row: MetricsDailyRow): void {
  db.prepare(
    `INSERT INTO metrics_daily (repo_id, date, stars, forks, open_issues, pushed_at, commit_activity, downloads)
     VALUES (@repo_id, @date, @stars, @forks, @open_issues, @pushed_at, @commit_activity, @downloads)
     ON CONFLICT(repo_id, date) DO UPDATE SET
       stars=excluded.stars,
       forks=excluded.forks,
       open_issues=excluded.open_issues,
       pushed_at=excluded.pushed_at,
       commit_activity=excluded.commit_activity,
       downloads=excluded.downloads`,
  ).run(row);
}

export function replaceCategoryCandidates(
  db: Database.Database,
  date: string,
  categoryId: string,
  repoIds: number[],
): void {
  const del = db.prepare(
    `DELETE FROM category_candidates WHERE date = ? AND category_id = ?`,
  );
  const ins = db.prepare(
    `INSERT INTO category_candidates (date, category_id, repo_id) VALUES (?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    del.run(date, categoryId);
    for (const id of repoIds) {
      ins.run(date, categoryId, id);
    }
  });
  tx();
}

export function replaceCategoryRankings(
  db: Database.Database,
  date: string,
  categoryId: string,
  rankings: Array<{
    repo_id: number;
    rank: number;
    score: number;
    breakdown: Record<string, number>;
  }>,
): void {
  const del = db.prepare(
    `DELETE FROM category_rankings WHERE date = ? AND category_id = ?`,
  );
  const ins = db.prepare(
    `INSERT INTO category_rankings (date, category_id, repo_id, rank, score, score_breakdown_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    del.run(date, categoryId);
    for (const r of rankings) {
      ins.run(
        date,
        categoryId,
        r.repo_id,
        r.rank,
        r.score,
        JSON.stringify(r.breakdown),
      );
    }
  });
  tx();
}

export function getStarsOnDate(
  db: Database.Database,
  repoId: number,
  date: string,
): number | null {
  const row = db
    .prepare(`SELECT stars FROM metrics_daily WHERE repo_id = ? AND date = ?`)
    .get(repoId, date) as { stars: number } | undefined;
  return row?.stars ?? null;
}

export function getNearestStarsBefore(
  db: Database.Database,
  repoId: number,
  date: string,
  withinDays = 40,
): number | null {
  const from = new Date(`${date}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - withinDays);
  const fromDate = from.toISOString().slice(0, 10);

  const row = db
    .prepare(
      `SELECT stars FROM metrics_daily
       WHERE repo_id = ? AND date < ? AND date >= ?
       ORDER BY date DESC LIMIT 1`,
    )
    .get(repoId, date, fromDate) as { stars: number } | undefined;
  return row?.stars ?? null;
}

export function getPreviousRankings(
  db: Database.Database,
  categoryId: string,
  beforeDate: string,
): Map<number, number> {
  const row = db
    .prepare(
      `SELECT date FROM category_rankings
       WHERE category_id = ? AND date < ?
       ORDER BY date DESC LIMIT 1`,
    )
    .get(categoryId, beforeDate) as { date: string } | undefined;

  if (!row) return new Map();

  const ranks = db
    .prepare(
      `SELECT repo_id, rank FROM category_rankings WHERE category_id = ? AND date = ?`,
    )
    .all(categoryId, row.date) as Array<{ repo_id: number; rank: number }>;

  return new Map(ranks.map((r) => [r.repo_id, r.rank]));
}
