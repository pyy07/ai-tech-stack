import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "@ai-tech-stack/shared";

export function getSnapshot(): Snapshot {
  const candidates = [
    path.join(process.cwd(), "../../data/snapshots/latest.json"),
    path.join(process.cwd(), "data/snapshots/latest.json"),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
    }
  }

  throw new Error("Could not find data/snapshots/latest.json");
}

export function getCategoryIds(): string[] {
  return getSnapshot().categories.map((c) => c.id);
}
