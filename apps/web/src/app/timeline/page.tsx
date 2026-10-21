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
        <p className="hero-kicker">FROM RULE-BASED MT TO FOUNDATION MODELS</p>
        <h1 className="hero-brand">
          理念 <em>时间轴</em>
        </h1>
        <p className="hero-lead">{doc.tagline}</p>
        <div className="meta-bar">
          <span className="meta-chip">
            节点 <strong>{concepts.length}</strong>
          </span>
          <span className="meta-chip">
            范围 <strong>1954→今</strong>
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
        时间取「工程侧广泛传播 / 定型」的近似月份，不争学术首创。语言主线：规则翻译
        → 统计翻译（Google Translate）→ 神经翻译 → Transformer / 大模型；ImageNet、
        PyTorch 等为深学与工具并行支线。每个节点保留人工种子，其余由流水线按热度补齐。
      </p>
    </>
  );
}
