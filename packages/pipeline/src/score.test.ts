import { minMaxNormalize, scoreRepos } from "./score.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const norm = minMaxNormalize([1, 2, 3]);
assert(norm[0] === 0 && norm[2] === 100, "minMaxNormalize failed");

const scored = scoreRepos(
  [
    {
      stars: 1000,
      star_growth_30d: 50,
      forks: 100,
      commit_activity: 20,
      downloads: 5000,
    },
    {
      stars: 100,
      star_growth_30d: 10,
      forks: 10,
      commit_activity: 5,
      downloads: null,
    },
  ],
  {
    stars: 0.2,
    star_growth_30d: 0.25,
    forks: 0.1,
    commit_activity: 0.15,
    downloads: 0.3,
  },
);

assert(scored[0]!.score > scored[1]!.score, "higher metrics should score higher");
assert(scored[1]!.breakdown.downloads === 0, "missing downloads should be 0 in breakdown");

console.log("score tests passed");
