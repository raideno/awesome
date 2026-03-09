// @ts-ignore: idk
import repository_ from "virtual:repository";

import React from "react";

import { useGitHubAuth } from "@/hooks/github-auth";
import { createRepositoryService } from "@/hooks/repository-service";
import { useCommitAwareStorage } from "@/hooks/commit-aware-storage";
import { useLocalStorageStateFactory } from "shared/hooks/local-storage-state";

import type { RepositoryVirtualModule } from "../../plugins/repository";

export interface RepositoryFileDiff {
  path: string;
  old: string;
  new: string;
}

export type Persistence = "repository" | "local" | "session";

export interface RepositoryContextType {
  files: {
    /**
     * The original build-time snapshot of all bundled files.
     * Lazily-fetched files are added here once resolved.
     */
    old: Record<string, string>;
    /**
     * The working copy for repository-level files. Starts as a shallow copy
     * of `old` and is updated on every `write` / `delete` / `reset` call
     * targeting `"repository"` persistence.
     */
    new: Record<string, string>;
    /**
     * Files written with `"local"` persistence. Stored in localStorage but
     * never pushed to the remote repository.
     */
    local: Record<string, string>;
    /**
     * Files written with `"session"` persistence. Stored in React state only;
     * lost when the tab is closed or the page is refreshed.
     */
    session: Record<string, string>;
  };
  changes: Record<string, RepositoryFileDiff>;
  get: (path: string) => Promise<string | null>;
  /**
   * Writes `content` to `path`.
   *
   * @param path - The file path to write.
   * @param content - The new content.
   * @param persistence - Where to persist the file:
   *   - `"repository"` *(default)* — commit-aware localStorage + pushed on `push()`.
   *   - `"local"` — localStorage only, never pushed.
   *   - `"session"` — in-memory only, lost on tab close / refresh.
   */
  write: (path: string, content: string, persistence?: Persistence) => void;
  delete: (path: string, persistence?: Persistence) => void;
  reset: () => void;
  push: (message: string) => Promise<void>;
}

const repository = repository_ as RepositoryVirtualModule;

const fetchFile = async (relativePath: string): Promise<string | null> => {
  const url = `${repository.baseUrl}/${relativePath}`;

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  /**
   * NOTE: for now html is considered to be the page's html, a fallback, so plugins better not use html files for storage as they won't receive it for now.
   */
  if (contentType.includes("text/html")) {
    return null;
  }

  return response.text();
};

const computeChanges = (
  oldFiles: Record<string, string>,
  newFiles: Record<string, string>,
): Record<string, RepositoryFileDiff> => {
  const result: Record<string, RepositoryFileDiff> = {};

  const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

  for (const path of allPaths) {
    const oldContent = oldFiles[path] ?? "";
    const newContent = newFiles[path] ?? "";

    if (oldContent !== newContent) {
      result[path] = { path, old: oldContent, new: newContent };
    }
  }

  return result;
};

const RepositoryContext = React.createContext<RepositoryContextType | undefined>(
  undefined,
);

export const useRepository = () => {
  const context = React.useContext(RepositoryContext);
  if (!context)
    throw new Error("useRepository must be used within a RepositoryProvider");
  return context;
};

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const githubAuth = useGitHubAuth();

  const [oldFiles, setOldFiles] = React.useState<Record<string, string>>(
    () => ({ ...repository.bundled }),
  );

  const {
    data: persistedNewFiles,
    setData: setPersistedNewFiles,
    clearData: clearPersistedNewFiles,
  } = useCommitAwareStorage<Record<string, string>>(
    "repository.newFiles",
    __CONFIGURATION__.repository.commit,
    { ...repository.bundled },
  );

  const [newFiles, setNewFilesState] = React.useState<Record<string, string>>(
    () => persistedNewFiles,
  );

  const setNewFiles = React.useCallback(
    (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
      setNewFilesState((prev) => {
        const next = updater instanceof Function ? updater(prev) : updater;
        setPersistedNewFiles(next);
        return next;
      });
    },
    [setPersistedNewFiles],
  );

  const useLocalStorageState = useLocalStorageStateFactory(
    __CONFIGURATION__.repository.owner,
    __CONFIGURATION__.repository.name,
  );

  const [localFiles, setLocalFiles] = useLocalStorageState<Record<string, string>>(
    "repository.localFiles",
    {},
  );

  const [sessionFiles, setSessionFiles] = React.useState<Record<string, string>>({});

  const changes = React.useMemo(
    () => computeChanges(oldFiles, newFiles),
    [oldFiles, newFiles],
  );

  const get = React.useCallback(
    async (path: string): Promise<string | null> => {
      if (path in newFiles) return newFiles[path];

      const content = await fetchFile(path);

      if (content === null) return null;

      setOldFiles((previous) => ({ ...previous, [path]: content }));
      setNewFiles((previous) => ({ ...previous, [path]: content }));

      return content;
    },
    [newFiles, setNewFiles],
  );

  const write = React.useCallback(
    (path: string, content: string, persistence: Persistence = "repository") => {
      switch (persistence) {
        case "repository":
          setNewFiles((previous) => ({ ...previous, [path]: content }));
          break;
        case "local":
          setLocalFiles((previous) => ({ ...previous, [path]: content }));
          break;
        case "session":
          setSessionFiles((previous) => ({ ...previous, [path]: content }));
          break;
      }
    },
    [setNewFiles, setLocalFiles],
  );

  const remove = React.useCallback(
    (path: string, persistence: Persistence = "repository") => {
      switch (persistence) {
        case "repository":
          setNewFiles((previous) => {
            const next = { ...previous };
            delete next[path];
            return next;
          });
          break;
        case "local":
          setLocalFiles((previous) => {
            const next = { ...previous };
            delete next[path];
            return next;
          });
          break;
        case "session":
          setSessionFiles((previous) => {
            const next = { ...previous };
            delete next[path];
            return next;
          });
          break;
      }
    },
    [setNewFiles, setLocalFiles],
  );

  const reset = React.useCallback(() => {
    clearPersistedNewFiles();
    setNewFilesState({ ...oldFiles });
  }, [oldFiles, clearPersistedNewFiles]);

  const push = React.useCallback(
    async (message: string): Promise<void> => {
      if (!githubAuth.isAuthenticated || !githubAuth.token) {
        throw new Error("Authentication required: no GitHub token available.");
      }

      const github = createRepositoryService({
        token: githubAuth.token,
        owner: __CONFIGURATION__.repository.owner,
        repo: __CONFIGURATION__.repository.name,
      });

      const diffs = computeChanges(oldFiles, newFiles);

      if (Object.keys(diffs).length === 0) {
        console.info("[repository](push): no changes to push");
        return;
      }

      // TODO: we should pack all changes in a single commit
      for (const { path, new: content } of Object.values(diffs)) {
        await github.write(path, content, message);
      }

      setOldFiles({ ...newFiles });
      clearPersistedNewFiles();
    },
    [githubAuth, oldFiles, newFiles, clearPersistedNewFiles],
  );

  return (
    <RepositoryContext.Provider
      value={{
        files: {
          old: oldFiles,
          new: newFiles,
          local: localFiles,
          session: sessionFiles,
        },
        changes,
        get,
        write,
        delete: remove,
        reset,
        push,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
};
