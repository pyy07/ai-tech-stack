export type ScoreBreakdown = {
  stars: number;
  star_growth_30d: number;
  forks: number;
  commit_activity: number;
  downloads: number;
};

export type ScoringWeights = ScoreBreakdown;

export type SnapshotRepo = {
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  score: number;
  rankChange: number | null;
  breakdown: ScoreBreakdown;
};

export type SnapshotRankedRepo = SnapshotRepo & {
  rank: number;
};

export type SnapshotLayer = {
  id: string;
  name: string;
  nameEn: string;
  order: number;
};

export type SnapshotCategory = {
  id: string;
  layerId: string;
  name: string;
  description: string;
  winner: SnapshotRepo | null;
  topN: SnapshotRankedRepo[];
};

export type Snapshot = {
  updatedAt: string;
  layers: SnapshotLayer[];
  categories: SnapshotCategory[];
};

export type TaxonomyLayer = {
  id: string;
  name: string;
  nameEn: string;
  order: number;
};

export type TaxonomyCategory = {
  id: string;
  layerId: string;
  name: string;
  description: string;
  languagePrefer?: string;
  minStars?: number;
  queries: string[];
  topics?: string[];
};

export type TaxonomyDiscovery = {
  maxCandidatesPerCategory: number;
  minStars: number;
  requireRecentPushDays: number;
  excludeForks: boolean;
  excludeArchived: boolean;
  excludeNamePatterns: string[];
  excludeTopics: string[];
};

export type Taxonomy = {
  layers: TaxonomyLayer[];
  categories: TaxonomyCategory[];
  discovery: TaxonomyDiscovery;
  scoring: {
    weights: ScoringWeights;
  };
};

export const SCORE_DIMENSIONS = [
  "stars",
  "star_growth_30d",
  "forks",
  "commit_activity",
  "downloads",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];
