import type { ScoreBreakdown, ScoringWeights } from "@ai-tech-stack/shared";
import { SCORE_DIMENSIONS } from "@ai-tech-stack/shared";

export type RawMetrics = {
  stars: number;
  star_growth_30d: number;
  forks: number;
  commit_activity: number;
  downloads: number | null;
};

function log1p(n: number): number {
  return Math.log1p(Math.max(0, n));
}

/** Min-max normalize a list of values to 0–100. Flat list → all 50. */
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

export function scoreRepos(
  metricsList: RawMetrics[],
  weights: ScoringWeights,
): Array<{ score: number; breakdown: ScoreBreakdown }> {
  const transformed = metricsList.map((m) => ({
    stars: log1p(m.stars),
    star_growth_30d: log1p(Math.max(0, m.star_growth_30d)),
    forks: log1p(m.forks),
    commit_activity: log1p(m.commit_activity),
    downloads: m.downloads == null ? null : log1p(m.downloads),
  }));

  const dims = SCORE_DIMENSIONS;
  const normalized: Record<string, (number | null)[]> = {};

  for (const dim of dims) {
    if (dim === "downloads") {
      const presentIdx: number[] = [];
      const presentVals: number[] = [];
      transformed.forEach((t, i) => {
        if (t.downloads != null) {
          presentIdx.push(i);
          presentVals.push(t.downloads);
        }
      });
      const norm = minMaxNormalize(presentVals);
      const arr: (number | null)[] = transformed.map(() => null);
      presentIdx.forEach((idx, j) => {
        arr[idx] = norm[j]!;
      });
      normalized.downloads = arr;
    } else {
      const vals = transformed.map((t) => t[dim] as number);
      normalized[dim] = minMaxNormalize(vals);
    }
  }

  return transformed.map((_, i) => {
    const available: Partial<Record<keyof ScoringWeights, number>> = {};
    for (const dim of dims) {
      const v = normalized[dim]![i];
      if (v != null && Number.isFinite(v)) {
        available[dim] = v;
      }
    }

    // Renormalize weights over available dimensions
    let weightSum = 0;
    for (const dim of Object.keys(available) as (keyof ScoringWeights)[]) {
      weightSum += weights[dim] ?? 0;
    }
    if (weightSum <= 0) weightSum = 1;

    let score = 0;
    const breakdown = {
      stars: 0,
      star_growth_30d: 0,
      forks: 0,
      commit_activity: 0,
      downloads: 0,
    } satisfies ScoreBreakdown;

    for (const dim of dims) {
      const v = available[dim];
      if (v == null) {
        breakdown[dim] = 0;
        continue;
      }
      breakdown[dim] = Math.round(v * 10) / 10;
      score += ((weights[dim] ?? 0) / weightSum) * v;
    }

    return {
      score: Math.round(score * 10) / 10,
      breakdown,
    };
  });
}
