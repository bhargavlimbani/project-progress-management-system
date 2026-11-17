/**
 * GitHub API integration service for live repository activity sync.
 * Extracts owner and repo from URLs and fetches metadata, recent commits, and branch info.
 */

const cache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function parseGitHubUrl(url) {
  if (!url || typeof url !== "string") return null;
  const cleaned = url.trim();
  // Match https://github.com/owner/repo or git@github.com:owner/repo
  const match = cleaned.match(/github\.com[:/]([^/]+)\/([^/.]+)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
  };
}

async function fetchGitHubStats(repoUrl) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { error: "Invalid GitHub repository URL", isValidUrl: false };
  }

  const { owner, repo } = parsed;
  const cacheKey = `${owner}/${repo}`.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SAPMS-Academic-Platform",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const [repoRes, commitsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=6`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=10`, { headers }),
    ]);

    if (repoRes.status === 404) {
      return {
        isValidUrl: true,
        isPrivateOrNotFound: true,
        error: "Repository is private or does not exist on GitHub.",
        owner,
        repo,
      };
    }

    if (repoRes.status === 403) {
      return {
        isValidUrl: true,
        rateLimited: true,
        error: "GitHub API rate limit exceeded. Please try again in a few minutes.",
        owner,
        repo,
      };
    }

    if (!repoRes.ok) {
      return {
        isValidUrl: true,
        error: `GitHub returned status ${repoRes.status}`,
        owner,
        repo,
      };
    }

    const repoData = await repoRes.json();
    const commitsData = commitsRes.ok ? await commitsRes.json() : [];
    const branchesData = branchesRes.ok ? await branchesRes.json() : [];

    const stats = {
      isValidUrl: true,
      owner,
      repo,
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      htmlUrl: repoData.html_url,
      defaultBranch: repoData.default_branch,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      language: repoData.language,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      branchCount: Array.isArray(branchesData) ? branchesData.length : 1,
      commits: Array.isArray(commitsData)
        ? commitsData.map((c) => ({
            sha: c.sha ? c.sha.slice(0, 7) : "",
            fullSha: c.sha,
            message: c.commit?.message?.split("\n")[0] || "",
            author: c.commit?.author?.name || c.author?.login || "Unknown",
            avatarUrl: c.author?.avatar_url || null,
            date: c.commit?.author?.date || c.commit?.committer?.date,
            htmlUrl: c.html_url,
          }))
        : [],
    };

    cache.set(cacheKey, { timestamp: Date.now(), data: stats });
    return stats;
  } catch (err) {
    return {
      isValidUrl: true,
      error: err.message || "Failed to reach GitHub API",
      owner,
      repo,
    };
  }
}

module.exports = {
  parseGitHubUrl,
  fetchGitHubStats,
};
