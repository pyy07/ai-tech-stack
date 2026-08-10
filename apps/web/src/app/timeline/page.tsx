import Link from "next/link";
import { ConceptTimeline } from "@/components/ConceptTimeline";
import { getConcepts, sortConceptsChronologically } from "@/lib/concepts";
import { formatUpdatedAt } from "@/lib/format";

export default function TimelinePage() {
  const doc = getConcepts();
  const concepts = sortConceptsChronologically(doc.concepts);
  const refreshed = doc.autoUpdatedAt ?? doc.updatedAt;

  return (
    <>
      <section className="hero hero-compact">
        <p className="hero-kicker">FROM TRANSFORMER TO LOOP ENGINEERING</p>
        <h1 className="hero-brand">
          理念 <em>时间轴</em>
        </h1>
        <p className="hero-lead">{doc.tagline}</p>
        <div className="meta-bar">
          <span className="meta-chip">
            节点 <strong>{concepts.length}</strong>
          </span>
          <span className="meta-chip">
            范围 <strong>2017→今</strong>
          </span>
          <span className="meta-chip">
            开源刷新 <strong>{formatUpdatedAt(refreshed)}</strong>
          </span>
          <Link href="/" className="meta-chip meta-chip-link">
            去技术栈 →
          </Link>
        </div>
      </section>
      <ConceptTimeline concepts={concepts} />
      <p className="timeline-footnote">
        时间取「自 Transformer 以来、工程侧广泛传播 / 定型」的近似月份，不争学术首创。每个节点会保留人工种子项目，其余名额由流水线按热度综合分自动补齐（与技术栈同一套评分）。
      </p>
    </>
  );
}
