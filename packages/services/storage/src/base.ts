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

export interface FileInfo {
  path: string;
  name: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
}

export interface WorkflowActionRefUpdateResult {
  updated: boolean;
  workflowPath: string;
  previousRef?: string;
  nextRef: string;
}

export abstract class BaseRepositoryService {
  abstract exists(path: string, ref?: string): Promise<boolean>;

  abstract read(path: string, ref?: string): Promise<{ content: string; sha: string }>;

  abstract list(path: string, ref?: string): Promise<Array<FileInfo>>;

  abstract write(
    path: string,
    content: string,
    commitMessage: string,
    sha?: string,
  ): Promise<void>;

  /**
   * TODO: rename to .versions and it'll fetch them all, no perPage parameter. Tags are a github specific thing.
   */
  // abstract listTags(perPage?: number): Promise<TagInfo[]>;
  abstract versions(size: number): Promise<TagInfo[]>;

  /**
   * TODO: rename to bump(), since the website is sort of defined by the file system.
   */
  abstract bump(params: {
    workflowIdentifier?: string;
    actionSlug: string;
    legacyActionSlugs?: string[];
    targetRef: string;
    commitMessage: string;
    branch?: string;
  }): Promise<WorkflowActionRefUpdateResult>;
}
