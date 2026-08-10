import type { Concept } from "@ai-tech-stack/shared";
import Link from "next/link";
import { formatCoinedAt } from "@/lib/concepts";

const SOURCE_LABEL: Record<string, string> = {
  paper: "论文",
  blog: "文章",
  talk: "演讲",
  docs: "文档",
  repo: "仓库",
};

export function ConceptTimeline({ concepts }: { concepts: Concept[] }) {
  return (
    <ol className="timeline" aria-label="AI 理念时间轴">
      {concepts.map((concept, index) => (
        <li key={concept.id} className="timeline-item" style={{ animationDelay: `${0.05 * index}s` }}>
          <div className="timeline-rail" aria-hidden="true">
            <span className="timeline-dot" />
          </div>
          <article className="timeline-card">
            <header className="timeline-card-head">
              <time className="timeline-when" dateTime={concept.coinedAt}>
                {formatCoinedAt(concept.coinedAt, concept.coinedPrecision)}
              </time>
              <span className="timeline-index">
                {String(index + 1).padStart(2, "0")}
              </span>
            </header>
            <h2 className="timeline-title">
              <span className="timeline-title-zh">{concept.nameZh}</span>
              <span className="timeline-title-en">{concept.name}</span>
            </h2>
            <p className="timeline-summary">{concept.summary}</p>

            {concept.sources.length > 0 && (
              <div className="timeline-block">
                <h3>出处</h3>
                <ul className="timeline-links">
                  {concept.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <span className="timeline-pill">
                          {SOURCE_LABEL[source.type] ?? source.type}
                        </span>
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {concept.implementations.length > 0 && (
              <div className="timeline-block">
                <h3>开源落地{concept.implementations.some((i) => i.role === "auto") ? "（含自动更新）" : ""}</h3>
                <ul className="timeline-impl">
                  {concept.implementations.map((impl) => (
                    <li key={impl.repo}>
                      <a href={impl.url} target="_blank" rel="noreferrer">
                        {impl.repo}
                      </a>
                      {impl.role === "auto" && (
                        <span className="timeline-pill">自动</span>
                      )}
                      {typeof impl.score === "number" && (
                        <span className="timeline-impl-meta">
                          {impl.score.toFixed(1)} 分
                          {typeof impl.stars === "number"
                            ? ` · ${impl.stars >= 1000 ? `${(impl.stars / 1000).toFixed(impl.stars >= 10000 ? 0 : 1)}k` : impl.stars}★`
                            : ""}
                        </span>
                      )}
                      <span className="timeline-impl-note">{impl.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {concept.relatedCategoryIds.length > 0 && (
              <div className="timeline-block">
                <h3>相关选型</h3>
                <div className="timeline-tags">
                  {concept.relatedCategoryIds.map((id) => (
                    <Link key={id} href={`/category/${id}/`} className="timeline-tag">
                      {id}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
