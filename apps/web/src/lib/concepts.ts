import fs from "node:fs";
import path from "node:path";
import type { ConceptsDocument } from "@ai-tech-stack/shared";

export function getConcepts(): ConceptsDocument {
  const candidates = [
    path.join(process.cwd(), "../../data/snapshots/concepts-latest.json"),
    path.join(process.cwd(), "data/snapshots/concepts-latest.json"),
    path.join(process.cwd(), "../../data/concepts.json"),
    path.join(process.cwd(), "data/concepts.json"),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8")) as ConceptsDocument;
    }
  }

  throw new Error("Could not find concepts-latest.json or concepts.json");
}

/** Sort ascending by coinedAt (YYYY or YYYY-MM or YYYY-MM-DD). */
export function sortConceptsChronologically<T extends { coinedAt: string }>(
  concepts: T[],
): T[] {
  return [...concepts].sort((a, b) => a.coinedAt.localeCompare(b.coinedAt));
}

export function formatCoinedAt(
  coinedAt: string,
  precision: "year" | "month" | "day",
): string {
  const [y, m, d] = coinedAt.split("-");
  if (precision === "year" || !m) return `${y} 年`;
  if (precision === "month" || !d) return `${y} 年 ${Number(m)} 月`;
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}
