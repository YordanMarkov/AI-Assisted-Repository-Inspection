import {
  buildRepositorySummary,
  MAX_ZIP_SIZE_BYTES,
} from "@/lib/repository-summary";

export const runtime = "nodejs";

type GitHubRepoReference = {
  owner: string;
  repo: string;
  branch?: string;
};

function parseGitHubUrl(value: string): GitHubRepoReference | null {
  try {
    const url = new URL(value.trim());
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return null;
    }

    const [owner, repo, tree, ...branchParts] = url.pathname
      .split("/")
      .filter(Boolean);

    if (!owner || !repo) return null;

    return {
      owner,
      repo: repo.replace(/\.git$/i, ""),
      branch: tree === "tree" && branchParts.length > 0
        ? branchParts.join("/")
        : undefined,
    };
  } catch {
    return null;
  }
}

async function getDefaultBranch(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "repository-inspection-experiment",
    },
  });

  if (!response.ok) {
    throw new Error(
      "Could not read this public GitHub repository. Check the URL and repository visibility.",
    );
  }

  const data = (await response.json()) as { default_branch?: string };
  return data.default_branch || "main";
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return Response.json(
        { error: "A public GitHub repository URL is required." },
        { status: 400 },
      );
    }

    const repoReference = parseGitHubUrl(url);
    if (!repoReference) {
      return Response.json(
        { error: "Please provide a valid github.com repository URL." },
        { status: 400 },
      );
    }

    const branch =
      repoReference.branch ||
      (await getDefaultBranch(repoReference.owner, repoReference.repo));
    const zipUrl = `https://codeload.github.com/${repoReference.owner}/${repoReference.repo}/zip/refs/heads/${branch}`;
    const zipResponse = await fetch(zipUrl, {
      headers: {
        "User-Agent": "repository-inspection-experiment",
      },
    });

    if (!zipResponse.ok) {
      throw new Error(
        "Could not download the repository ZIP from GitHub. The branch may not exist or the repository may be inaccessible.",
      );
    }

    const contentLength = Number(zipResponse.headers.get("content-length") || 0);
    if (contentLength > MAX_ZIP_SIZE_BYTES) {
      throw new Error("GitHub repository ZIP is too large. Please use a repository under 60 MB.");
    }

    const blob = await zipResponse.blob();
    if (blob.size > MAX_ZIP_SIZE_BYTES) {
      throw new Error("GitHub repository ZIP is too large. Please use a repository under 60 MB.");
    }

    const file = new File(
      [blob],
      `${repoReference.owner}-${repoReference.repo}-${branch}.zip`,
      { type: "application/zip" },
    );
    const summary = await buildRepositorySummary(file);

    return Response.json({
      summary: {
        ...summary,
        projectName: `${repoReference.owner}/${repoReference.repo}`,
        uploadedFileName: `${repoReference.owner}/${repoReference.repo} (${branch})`,
      },
      source: {
        type: "github",
        url,
        owner: repoReference.owner,
        repo: repoReference.repo,
        branch,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "GitHub repository inspection failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}
