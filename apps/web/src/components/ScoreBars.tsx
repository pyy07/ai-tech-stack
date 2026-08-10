import type { ScoreBreakdown } from "@ai-tech-stack/shared";

const LABELS: Record<keyof ScoreBreakdown, string> = {
  stars: "Stars",
  star_growth_30d: "30d 增长",
  forks: "Forks",
  commit_activity: "提交活跃",
  downloads: "下载量",
};

export function ScoreBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  const entries = Object.entries(breakdown) as Array<
    [keyof ScoreBreakdown, number]
  >;

  return (
    <div className="bars">
      {entries.map(([key, value], i) => (
        <div className="bar-row" key={key}>
          <span>{LABELS[key]}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(0, Math.min(100, value))}%`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          </div>
          <span>{value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}
