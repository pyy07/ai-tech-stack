# AI Tech Stack

每日更新的 AI 技术栈开源选型地图：分层可视化展示各类别综合得分最高的开源项目。

## 功能

- **分层架构图**：应用 / Agent / 模型 / RAG / 评测 / 基础设施
- **全自动发现**：按 `data/taxonomy.yaml` 中的 GitHub Search 规则拉取候选
- **综合得分**：stars、近 30 天增长、forks、提交活跃度、npm/PyPI 下载量（可配置权重）
- **静态站点**：Next.js 静态导出，只读每日 `latest.json`

## 仓库结构

```
apps/web              # Next.js 前端
packages/pipeline     # 发现 / 打分 / 导出流水线
packages/shared       # 共享类型
data/taxonomy.yaml    # 分层、发现规则、权重
data/snapshots/       # 每日 JSON 快照
data/metrics.db       # SQLite 历史指标（本地/CI 生成）
```

## 快速开始

```bash
pnpm install
pnpm dev                 # http://localhost:3000 （使用样例/已有 snapshot）
```

### 运行流水线

需要 GitHub Token（Search API）。推荐用仓库根目录 `.env`（已在 `.gitignore`）：

```bash
cp .env.example .env
# 编辑 .env，填入 GITHUB_TOKEN=ghp_...
```

或在当前 PowerShell 会话设置：

```powershell
$env:GITHUB_TOKEN = 'ghp_xxx'   # 单引号，不要多余空格
pnpm pipeline:check-auth        # 应打印 OK — authenticated as <你的用户名>
pnpm pipeline:run -- --dry-run --limit 1
```

若出现 `401 Bad credentials`：说明变量里有值但 GitHub 不认（过期、复制残缺、多了引号）。先 `pnpm pipeline:check-auth` 看 token 前缀与长度，再重新生成 PAT。

常用参数：

| 参数 | 说明 |
|------|------|
| `--dry-run` | 不写库、不改 snapshot |
| `--limit N` | 只处理前 N 个类别 |
| `--skip-downloads` | 跳过 npm/PyPI |
| `--date YYYY-MM-DD` | 指定快照日期 |

### 构建站点

```bash
pnpm build
# 产物在 apps/web/out
```

## 数据流

1. GitHub Actions 每日定时（或手动）运行 `packages/pipeline`
2. 发现候选 → 拉取指标 → 加权打分 → 写入 `data/metrics.db`
3. 导出 `data/snapshots/latest.json` 与按日归档
4. 提交变更；前端构建时读取 snapshot

## 评分说明

权重默认见 `data/taxonomy.yaml` → `scoring.weights`。缺下载量时该维权重会在其余维度上重新归一。首次运行没有历史星标时，`star_growth_30d` 为 0。

详见站点 [/about](./apps/web/src/app/about/page.tsx) 文案。

## 许可证

MIT
