import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (…/ai-tech-stack) */
export const ROOT_DIR = path.resolve(__dirname, "../../..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const TAXONOMY_PATH = path.join(DATA_DIR, "taxonomy.yaml");
export const DB_PATH = path.join(DATA_DIR, "metrics.db");
export const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
