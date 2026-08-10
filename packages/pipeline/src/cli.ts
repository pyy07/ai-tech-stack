#!/usr/bin/env node
import { GitHubClient } from "./github.js";
import { resolveGitHubToken } from "./env.js";
import { runPipeline } from "./run.js";

function printHelp(): void {
  console.log(`ai-tech-stack pipeline

Usage:
  pnpm pipeline:run -- [options]
  pnpm pipeline:check-auth

Options:
  --dry-run              Discover & score without writing DB/snapshots
  --date YYYY-MM-DD      Snapshot date (default: today UTC)
  --limit N              Only process first N categories
  --skip-downloads       Skip npm/PyPI download lookups
  --help                 Show help

Auth:
  Set GITHUB_TOKEN in the environment, or create repo-root .env:
    GITHUB_TOKEN=ghp_your_token_here
`);
}

function parseArgs(argv: string[]) {
  let args = argv.slice(2);
  const command = args[0] === "check-auth" || args[0] === "run" ? args[0] : "run";
  if (args[0] === "check-auth" || args[0] === "run") {
    args = args.slice(1);
  }

  const opts: {
    command: string;
    dryRun?: boolean;
    date?: string;
    limitCategories?: number;
    skipDownloads?: boolean;
    help?: boolean;
  } = { command };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") continue;
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--skip-downloads") opts.skipDownloads = true;
    else if (a === "--date") opts.date = args[++i];
    else if (a === "--limit") opts.limitCategories = Number(args[++i]);
    else if (a.startsWith("--date=")) opts.date = a.slice("--date=".length);
    else if (a.startsWith("--limit="))
      opts.limitCategories = Number(a.slice("--limit=".length));
  }

  return opts;
}

async function checkAuth(): Promise<void> {
  const { token, source } = resolveGitHubToken();
  if (!token) {
    throw new Error(
      "No GITHUB_TOKEN found. Set $env:GITHUB_TOKEN or create .env at repo root.",
    );
  }
  console.log(`[github] resolved source=${source}`);
  const client = new GitHubClient(token);
  const user = await client.verifyAuth();
  console.log(`[github] OK — authenticated as ${user.login}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.command === "check-auth") {
    await checkAuth();
    return;
  }

  await runPipeline({
    dryRun: opts.dryRun,
    date: opts.date,
    limitCategories: opts.limitCategories,
    skipDownloads: opts.skipDownloads,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
