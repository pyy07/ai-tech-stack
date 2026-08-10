import type { SnapshotCategory, SnapshotRepo } from "@ai-tech-stack/shared";
import Link from "next/link";
import { formatScore, formatStars, rankChangeLabel } from "@/lib/format";

function RankDelta({ change }: { change: number | null | undefined }) {
  const label = rankChangeLabel(change);
  const cls =
    change == null || change === 0
      ? "rank-flat"
      : change > 0
        ? "rank-up"
        : "rank-down";
  return <span className={cls}>{label}</span>;
}

function projectLabel(winner: SnapshotRepo | null): string {
  if (!winner) return "暂无数据";
  return winner.fullName.split("/")[1] ?? winner.fullName;
}

export function CategoryCell({ category }: { category: SnapshotCategory }) {
  return (
    <Link href={`/category/${category.id}/`} className="cell">
      <div>
        <div className="cell-cat">{category.name}</div>
        <div className="cell-project">{projectLabel(category.winner)}</div>
      </div>
      <div className="cell-meta">
        <span className="score">
          {category.winner ? formatScore(category.winner.score) : "—"}
        </span>
        <div className="cell-side">
          <div>{category.winner ? `${formatStars(category.winner.stars)} ★` : ""}</div>
          <div>
            <RankDelta change={category.winner?.rankChange} />
          </div>
        </div>
      </div>
    </Link>
  );
}
