import { useMemo } from "react";

import {
  GitHubService,
  LocalRepositoryService,
  type BaseRepositoryService,
  type GitHubConfig,
} from "storage-service";

import { useGitHubAuth } from "@/hooks/github-auth";

/**
 * Returns a repository service instance memoised on the current auth token.
 *
 * - In Vite dev mode  → `LocalRepositoryService` (namespaced to owner/repo,
 *   backed by localStorage — no token or network needed).
 * - In production     → `GitHubService` talking to the real GitHub API.
 */
export function useRepositoryService(
  owner: string = __CONFIGURATION__.repository.owner,
  repo: string = __CONFIGURATION__.repository.name,
): BaseRepositoryService {
  const { token } = useGitHubAuth();

  return useMemo<BaseRepositoryService>(() => {
    if (import.meta.env.DEV) {
      return new LocalRepositoryService(`${owner}/${repo}`);
    }

    const config: GitHubConfig = {
      token: token || undefined,
      owner,
      repo,
    };

    return new GitHubService(config);
  }, [owner, repo, token]);
}

/**
 * Bare factory for use outside of React components (e.g. in event handlers
 * or query functions that already have the token available).
 */
export function createRepositoryService(
  config: GitHubConfig,
): BaseRepositoryService {
  if (import.meta.env.DEV) {
    return new LocalRepositoryService(`${config.owner}/${config.repo}`);
  }

  return new GitHubService(config);
}
