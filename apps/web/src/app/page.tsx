import Link from "next/link";
import { StackMap } from "@/components/StackMap";
import { formatUpdatedAt } from "@/lib/format";
import { getSnapshot } from "@/lib/snapshot";

export default function HomePage() {
  const snapshot = getSnapshot();

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">DAILY OPEN-SOURCE STACK</p>
        <h1 className="hero-brand">
          AI <em>Tech Stack</em>
        </h1>
        <p className="hero-lead">
          每日更新的 AI 开源技术栈选型：按分层展示当前综合得分最高的项目，帮你快速判断该用什么。
        </p>
        <div className="meta-bar">
          <span className="meta-chip">
            更新 <strong>{formatUpdatedAt(snapshot.updatedAt)}</strong>
            <span style={{ opacity: 0.7 }}>（北京时间）</span>
          </span>
          <span className="meta-chip">
            类别 <strong>{snapshot.categories.length}</strong>
          </span>
          <span className="meta-chip">
            分层 <strong>{snapshot.layers.length}</strong>
          </span>
          <Link href="/timeline/" className="meta-chip meta-chip-link">
            理念时间轴 →
          </Link>
        </div>
      </section>
      <StackMap snapshot={snapshot} />
    </>
  );
}
