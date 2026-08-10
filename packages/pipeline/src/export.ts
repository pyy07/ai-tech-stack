import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "@ai-tech-stack/shared";
import { SNAPSHOTS_DIR } from "./paths.js";

export function writeSnapshots(snapshot: Snapshot, date: string): void {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const latestPath = path.join(SNAPSHOTS_DIR, "latest.json");
  const datedPath = path.join(SNAPSHOTS_DIR, `${date}.json`);
  const json = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(latestPath, json + "\n", "utf8");
  fs.writeFileSync(datedPath, json + "\n", "utf8");
  console.log(`Wrote ${latestPath}`);
  console.log(`Wrote ${datedPath}`);
}
