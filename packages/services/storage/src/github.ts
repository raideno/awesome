import { Octokit } from "@octokit/rest";

import {
  BaseRepositoryService,
  type FileAtRef,
  type FileInfo,
  type TagInfo,
  type WorkflowActionRefUpdateResult,
} from "./base";

export type { FileAtRef, FileInfo, TagInfo, WorkflowActionRefUpdateResult };

export interface GitHubConfig {
  token?: string;
  owner: string;
  repo: string;
  branch?: string;
}

export class GitHubService extends BaseRepositoryService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    super();
    this.config = {
      branch: "main",
      ...config,
    };

    this.octokit = new Octokit({
      auth: this.config.token,
    });
  }

  async exists(path: string, ref: string = this.config.branch || "main"): Promise<boolean> {
    try {
      await this.read(path, ref);
      return true;
    } catch {
      return false;
    }
  }

  async read(path: string, ref: string = this.config.branch || "main"): Promise<{ content: string; sha: string }> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref,
      });

      if ("content" in response.data && !Array.isArray(response.data)) {
        return {
          content: decodeURIComponent(escape(atob(response.data.content))),
          sha: response.data.sha,
        };
      }

      throw new Error("File not found or is a directory");
    } catch (error) {
      throw new Error(
        `Failed to get file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async list(path: string, ref: string = this.config.branch || "main"): Promise<Array<FileInfo>> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref,
      });

      if (!Array.isArray(response.data)) {
        throw new Error(`"${path}" is not a directory`);
      }

      return response.data.map((entry) => ({
        path: entry.path,
        name: entry.name,
        sha: entry.sha,
        size: entry.size,
        type: entry.type as FileInfo["type"],
      }));
    } catch (error) {
      throw new Error(
        `Failed to list directory: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async write(
    path: string,
    content: string,
    commitMessage: string,
    sha?: string,
  ): Promise<void> {
    try {
      let fileSha = sha;
      if (!fileSha) {
        try {
          const existingFile = await this.read(path);
          fileSha = existingFile.sha;
        } catch {
          // File doesn't exist yet — create it without a sha
        }
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(content))),
        sha: fileSha,
        branch: this.config.branch,
      });
    } catch (error) {
      throw new Error(
        `Failed to update file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  versions(size: number): Promise<TagInfo[]> {
    return this.octokit.rest.repos
      .listTags({
        owner: this.config.owner,
        repo: this.config.repo,
        per_page: size,
      })
      .then((response) =>
        response.data.map((tag) => ({
          name: tag.name,
          commitSha: tag.commit.sha,
          tarballUrl: tag.tarball_url,
          zipballUrl: tag.zipball_url,
        })),
      )
      .catch((error) => {
        throw new Error(
          `Failed to list tags: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      });
  }

  async bump({
    workflowIdentifier,
    actionSlug,
    legacyActionSlugs,
    targetRef,
    commitMessage,
    branch,
  }: {
    workflowIdentifier?: string;
    actionSlug: string;
    legacyActionSlugs?: string[];
    targetRef: string;
    commitMessage: string;
    branch?: string;
  }): Promise<WorkflowActionRefUpdateResult> {
    try {
      const ref = branch || this.config.branch || "main";
      const actionSlugs = Array.from(
        new Set([actionSlug, ...(legacyActionSlugs || [])].filter(Boolean)),
      );

      const candidatePaths = new Set<string>();
      if (workflowIdentifier) {
        candidatePaths.add(workflowIdentifier);

        if (/\.ya?ml$/i.test(workflowIdentifier)) {
          candidatePaths.add(`.github/workflows/${workflowIdentifier}`);
        }
      }

      let workflowFile: FileAtRef | null = null;

      if (workflowIdentifier) {
        try {
          const workflowMeta = await this.octokit.rest.actions.getWorkflow({
            owner: this.config.owner,
            repo: this.config.repo,
            workflow_id: workflowIdentifier,
          });

          if (workflowMeta.data.path) {
            const file = await this.read(workflowMeta.data.path, ref);
            workflowFile = {
              path: workflowMeta.data.path,
              content: file.content,
              sha: file.sha,
            };
          }
        } catch {
          // fallback to path probing and content search
        }
      }

      if (!workflowFile) {
        for (const path of candidatePaths) {
          try {
            const file = await this.read(path, ref);
            workflowFile = {
              path,
              content: file.content,
              sha: file.sha,
            };
            break;
          } catch {
            // try next candidate
          }
        }
      }

      if (!workflowFile) {
        const workflows = await this.octokit.rest.repos.getContent({
          owner: this.config.owner,
          repo: this.config.repo,
          path: ".github/workflows",
          ref,
        });

        if (!Array.isArray(workflows.data)) {
          throw new Error("Invalid .github/workflows directory response");
        }

        const workflowPaths = workflows.data
          .filter(
            (entry) => entry.type === "file" && /\.ya?ml$/i.test(entry.name),
          )
          .map((entry) => entry.path)
          .filter((path): path is string => Boolean(path));

        for (const path of workflowPaths) {
          try {
            const file = await this.read(path, ref);

            if (
              actionSlugs.some((slug) =>
                file.content.includes(`uses: ${slug}@`),
              )
            ) {
              workflowFile = {
                path,
                content: file.content,
                sha: file.sha,
              };
              break;
            }
          } catch {
            // try next workflow file
          }
        }
      }

      if (!workflowFile) {
        throw new Error(
          `Could not find a workflow file referencing any of: ${actionSlugs
            .map((slug) => `'${slug}@...'`)
            .join(", ")}`,
        );
      }

      const escapedActionSlugs = actionSlugs.map((slug) =>
        slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      );
      const actionRefRegex = new RegExp(
        `(^\\s*uses:\\s*)(${escapedActionSlugs.join("|")})(@)([^\\s#]+)(.*)$`,
        "gm",
      );

      let previousRef: string | undefined;
      let hasMatch = false;

      const updatedWorkflowContent = workflowFile.content.replace(
        actionRefRegex,
        (
          _match,
          prefix: string,
          matchedSlug: string,
          atSign: string,
          currentRef: string,
          suffix: string,
        ) => {
          hasMatch = true;
          if (!previousRef) previousRef = currentRef;
          return `${prefix}${matchedSlug}${atSign}${targetRef}${suffix}`;
        },
      );

      if (!hasMatch) {
        throw new Error(
          `No matching 'uses:' entry found for any of ${actionSlugs
            .map((slug) => `'${slug}@...'`)
            .join(", ")} in ${workflowFile.path}`,
        );
      }

      if (previousRef === targetRef) {
        return {
          updated: false,
          workflowPath: workflowFile.path,
          previousRef,
          nextRef: targetRef,
        };
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: workflowFile.path,
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(updatedWorkflowContent))),
        sha: workflowFile.sha,
        branch: ref,
      });

      return {
        updated: true,
        workflowPath: workflowFile.path,
        previousRef,
        nextRef: targetRef,
      };
    } catch (error) {
      throw new Error(
        `Failed to update workflow action ref: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
