import { Octokit } from "@octokit/rest";
import * as yaml from "js-yaml";

export interface GitHubConfig {
  token?: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface TagInfo {
  name: string;
  commitSha: string;
  tarballUrl?: string;
  zipballUrl?: string;
}

export interface FileAtRef {
  path: string;
  content: string;
  sha: string;
}

export interface WorkflowActionRefUpdateResult {
  updated: boolean;
  workflowPath: string;
  previousRef?: string;
  nextRef: string;
}

export type YamlUpdatableContent = Record<string, unknown> & {
  readme?: string;
};

export class GitHubService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = {
      branch: "main",
      ...config,
    };

    this.octokit = new Octokit({
      auth: this.config.token,
    });
  }

  async getFile(path: string, ref: string = this.config.branch || "main") {
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

  async updateYamlFile(
    path: string,
    content: YamlUpdatableContent,
    commitMessage: string,
    sha?: string,
  ): Promise<void> {
    try {
      const { readme, ...yamlData } = content;

      const yamlContent = yaml.dump(yamlData, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      let fileSha = sha;
      if (!fileSha) {
        const existingFile = await this.getFile(path);
        fileSha = existingFile.sha;
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(yamlContent))),
        sha: fileSha,
        branch: this.config.branch,
      });

      if (readme !== undefined) {
        const readmePath = path.replace(/[^/]+$/, "README.md");
        try {
          let readmeSha: string | undefined;
          try {
            const existingReadme = await this.getFile(readmePath);
            readmeSha = existingReadme.sha;
          } catch {
            readmeSha = undefined;
          }

          await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path: readmePath,
            message: `${commitMessage} (update README)`,
            content: btoa(unescape(encodeURIComponent(readme))),
            sha: readmeSha,
            branch: this.config.branch,
          });
        } catch (error) {
          console.warn("Failed to update README.md:", error);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to update file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // backward-compatible alias
  async update(
    path: string,
    content: YamlUpdatableContent,
    commitMessage: string,
    sha?: string,
  ): Promise<void> {
    return this.updateYamlFile(path, content, commitMessage, sha);
  }

  async getDeploymentWorkflowRuns(workflowFileName: string): Promise<{
    isRunning: boolean;
    latestRun?: {
      id: number;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      workflow_name: string;
      head_sha: string;
    };
  }> {
    try {
      const response = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.config.owner,
        repo: this.config.repo,
        workflow_id: workflowFileName,
        branch: "main",
        per_page: 1,
      });

      if (response.data.workflow_runs.length === 0) {
        return { isRunning: false };
      }

      const latestRun = response.data.workflow_runs[0];
      const isRunning =
        latestRun.status === "in_progress" || latestRun.status === "queued";

      return {
        isRunning,
        latestRun: {
          id: latestRun.id,
          status: latestRun.status || "unknown",
          conclusion: latestRun.conclusion,
          html_url: latestRun.html_url,
          created_at: latestRun.created_at,
          workflow_name: latestRun.name || "Deployment",
          head_sha: latestRun.head_sha,
        },
      };
    } catch (error) {
      console.warn("[error]: failed to get deployment workflow runs:", error);
      return { isRunning: false };
    }
  }

  async getLatestTag() {
    try {
      const tags = await this.listTags(1);
      const latestTag = tags[0];

      if (!latestTag) {
        throw new Error("No tags found");
      }

      return latestTag;
    } catch (error) {
      throw new Error(
        `Failed to get latest tag: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listTags(perPage: number = 30) {
    try {
      const response = await this.octokit.rest.repos.listTags({
        owner: this.config.owner,
        repo: this.config.repo,
        per_page: perPage,
      });

      return response.data.map((tag) => ({
        name: tag.name,
        commitSha: tag.commit.sha,
        tarballUrl: tag.tarball_url,
        zipballUrl: tag.zipball_url,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list tags: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getFirstExistingFileAtRef(
    paths: string[],
    ref: string,
  ): Promise<FileAtRef> {
    for (const path of paths) {
      try {
        const file = await this.getFile(path, ref);
        return {
          path,
          content: file.content,
          sha: file.sha,
        };
      } catch {
        // try next path
      }
    }

    throw new Error(
      `None of the files were found at ref '${ref}': ${paths.join(", ")}`,
    );
  }

  async updateWorkflowActionRef({
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
            const file = await this.getFile(workflowMeta.data.path, ref);
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
            const file = await this.getFile(path, ref);
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
            const file = await this.getFile(path, ref);

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
