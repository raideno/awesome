import {
  BaseRepositoryService,
  type FileAtRef,
  type FileInfo,
  type TagInfo,
  type WorkflowActionRefUpdateResult,
} from "./base";

export type { FileAtRef, FileInfo, TagInfo, WorkflowActionRefUpdateResult };

interface StoredFile {
  content: string;
  sha: string;
}

interface LocalStore {
  files: Record<string, StoredFile>;
}

const nextSha = (() => {
  let counter = 1;
  return () => String(counter++);
})();

export class LocalRepositoryService extends BaseRepositoryService {
  private readonly storageKey: string;

  constructor(namespace: string = "default") {
    super();
    this.storageKey = `local-repository-service:${namespace}`;
  }

  private load(): LocalStore {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { files: {} };
      return JSON.parse(raw) as LocalStore;
    } catch {
      return { files: {} };
    }
  }

  private save(store: LocalStore): void {
    localStorage.setItem(this.storageKey, JSON.stringify(store));
  }

  private getStored(path: string): StoredFile | undefined {
    return this.load().files[path];
  }

  private putStored(path: string, content: string): StoredFile {
    const store = this.load();
    const existing = store.files[path];
    const file: StoredFile = {
      content,
      sha: existing ? nextSha() : nextSha(),
    };
    store.files[path] = file;
    this.save(store);
    return file;
  }

  async exists(path: string, _ref?: string): Promise<boolean> {
    return this.getStored(path) !== undefined;
  }

  async read(path: string, _ref?: string): Promise<{ content: string; sha: string }> {
    const file = this.getStored(path);
    if (!file) {
      throw new Error(`Failed to get file: file not found at "${path}"`);
    }
    return { content: file.content, sha: file.sha };
  }

  async list(dirPath: string, _ref?: string): Promise<Array<FileInfo>> {
    const store = this.load();
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;

    return Object.entries(store.files)
      .filter(([p]) => {
        if (!p.startsWith(prefix)) return false;
        // Only direct children — no nested paths.
        const remainder = p.slice(prefix.length);
        return remainder.length > 0 && !remainder.includes("/");
      })
      .map(([p, file]) => ({
        path: p,
        name: p.slice(prefix.length),
        sha: file.sha,
        size: file.content.length,
        type: "file" as const,
      }));
  }

  async write(
    path: string,
    content: string,
    _commitMessage: string,
    _sha?: string,
  ): Promise<void> {
    this.putStored(path, content);
  }

  versions(_: number): Promise<TagInfo[]> {
    return [] as unknown as Promise<Array<TagInfo>>;
  }

  async bump(_params: {
    workflowIdentifier?: string;
    actionSlug: string;
    legacyActionSlugs?: string[];
    targetRef: string;
    commitMessage: string;
    branch?: string;
  }): Promise<WorkflowActionRefUpdateResult> {
    throw new Error("LocalRepositoryService: bump is not supported.");
  }

  /**
   * Seeds a file into the local store without going through a commit message.
   * Useful for pre-populating dev fixtures.
   */
  seed(path: string, content: string): this {
    this.putStored(path, content);
    return this;
  }

  /**
   * Wipes all stored files for this namespace.
   */
  clear(): this {
    this.save({ files: {} });
    return this;
  }

  /**
   * Returns a snapshot of all stored files, useful for inspection in dev tools.
   */
  dump(): Record<string, string> {
    const store = this.load();
    return Object.fromEntries(
      Object.entries(store.files).map(([path, file]) => [path, file.content]),
    );
  }
}
