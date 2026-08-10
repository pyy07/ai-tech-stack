import fs from "node:fs";
import YAML from "yaml";
import type { Taxonomy } from "@ai-tech-stack/shared";
import { TAXONOMY_PATH } from "./paths.js";

export function loadTaxonomy(filePath = TAXONOMY_PATH): Taxonomy {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(raw) as Taxonomy;

  if (!parsed?.layers?.length || !parsed?.categories?.length) {
    throw new Error(`Invalid taxonomy at ${filePath}`);
  }
  if (!parsed.discovery || !parsed.scoring?.weights) {
    throw new Error(`Taxonomy missing discovery or scoring.weights`);
  }

  return parsed;
}
