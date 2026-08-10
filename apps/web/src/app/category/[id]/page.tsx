import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBars } from "@/components/ScoreBars";
import {
  formatScore,
  formatStars,
  formatUpdatedAt,
  rankChangeLabel,
} from "@/lib/format";
import { getCategoryIds, getSnapshot } from "@/lib/snapshot";

export function generateStaticParams() {
  return getCategoryIds().map((id) => ({ id }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = getSnapshot();
  const category = snapshot.categories.find((c) => c.id === id);
  if (!category) notFound();

  const layer = snapshot.layers.find((l) => l.id === category.layerId);

  return (
    <>
      <section className="detail-header">
        <Link href="/" className="back-link">
          ← 返回技术栈
        </Link>
        <h1>{category.name}</h1>
        <p>
          {layer?.name ?? category.layerId} · {category.description}
        </p>
        <div className="meta-bar">
          <span>
            更新 <strong>{formatUpdatedAt(snapshot.updatedAt)}</strong>
          </span>
        </div>
      </section>

      {category.winner ? (
        <section className="panel">
          <h2>当日推荐</h2>
          <p className="winner-name">
            <a href={category.winner.url} target="_blank" rel="noreferrer">
              {category.winner.fullName}
            </a>
          </p>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            {category.winner.description}
          </p>
          <div className="meta-bar">
            <span>
              综合分 <strong>{formatScore(category.winner.score)}</strong>
            </span>
            <span>
              Stars <strong>{formatStars(category.winner.stars)}</strong>
            </span>
            <span>
              语言 <strong>{category.winner.language ?? "—"}</strong>
            </span>
            <span>
              排名变化{" "}
              <strong>{rankChangeLabel(category.winner.rankChange)}</strong>
            </span>
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <ScoreBars breakdown={category.winner.breakdown} />
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>当日推荐</h2>
          <p>暂无数据，请先运行流水线生成 snapshot。</p>
        </section>
      )}

      <section className="panel">
        <h2>Top 候选</h2>
        <ol className="rank-list">
          {category.topN.map((repo) => (
            <li key={repo.fullName} className="rank-item">
              <span className="rank-num">#{repo.rank}</span>
              <div>
                <h3>
                  <a href={repo.url} target="_blank" rel="noreferrer">
                    {repo.fullName}
                  </a>
                </h3>
                <p>{repo.description}</p>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.75rem" }}>
                <div className="score">{formatScore(repo.score)}</div>
                <div style={{ color: "var(--muted)" }}>
                  {formatStars(repo.stars)}★ · {rankChangeLabel(repo.rankChange)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
