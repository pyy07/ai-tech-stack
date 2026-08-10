import Link from "next/link";

export default function AboutPage() {
  return (
    <article className="prose">
      <h1>方法论</h1>
      <p>
        AI Tech Stack 提供两个入口：
        <Link href="/">技术栈</Link>
        （每日热度推荐开源）与
        <Link href="/timeline/">理念时间轴</Link>
        （从 Transformer 到 Loop Engineering 的范式演进）。技术栈分层固定，每个类别下的候选开源项目由
        GitHub Search 按规则自动发现，再根据多维指标算出综合分，每日更新「当前推荐」。
      </p>

      <h2>理念时间轴</h2>
      <p>
        时间轴数据在 <code>data/concepts.json</code>{" "}
        中人工维护概念与发现规则；代表开源项目由 Daily Update
        流水线自动发现并打分，写入 <code>data/snapshots/concepts-latest.json</code>
        。种子项目会置顶保留，其余名额按综合分补齐。
      </p>

      <h2>自动发现</h2>
      <p>
        每个类别在 <code>data/taxonomy.yaml</code>{" "}
        中配置查询语句与 topic。流水线调用 GitHub Search
        API 拉取候选，并过滤：fork、archived、过低 stars、长期无推送、awesome-list
        类仓库等。每类保留有限数量候选再进入打分。
      </p>

      <h2>综合得分</h2>
      <ul>
        <li>
          <strong>stars</strong> — 仓库星标（log 归一化）
        </li>
        <li>
          <strong>star_growth_30d</strong> — 约 30 天星标增长（依赖历史快照）
        </li>
        <li>
          <strong>forks</strong> — Fork 数
        </li>
        <li>
          <strong>commit_activity</strong> — 近一季度提交活跃度
        </li>
        <li>
          <strong>downloads</strong> — npm 周下载或 PyPI 近月下载（按主语言）
        </li>
      </ul>
      <p>
        各维归一化到 0–100 后按可配置权重加权。若某仓库缺少下载量数据，该维权重会在其余维度上重新归一。
      </p>

      <h2>免责声明</h2>
      <p>
        全自动发现会产生噪声；高分反映公开流行度与活跃度的加权结果，
        <strong>不等于</strong>
        生产就绪、安全合规或最适合你的业务。选型请结合许可证、文档、社区与自身场景验证。
      </p>

      <p>
        <Link href="/">← 返回技术栈</Link>
        {" · "}
        <Link href="/timeline/">理念时间轴</Link>
      </p>
    </article>
  );
}
