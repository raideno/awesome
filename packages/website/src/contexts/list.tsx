// @ts-ignore: idk
import list_ from "virtual:awesome-list";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo } from "react";

import { useDocumentTitle } from "shared/hooks/document-title";
import { useDynamicMetadata } from "shared/hooks/dynamic-metadata";
import { AwesomeListSchema } from "shared/types/list";
import { deepEqual } from "shared/lib/utils";

import type { AwesomeList } from "shared/types/list";

import { useRepositoryService } from "@/hooks/repository-service";

import * as yaml from "js-yaml";

import { useCommitAwareStorage } from "@/hooks/commit-aware-storage";
import { useGitHubAuth } from "@/hooks/github-auth";

export interface ListContextType {
  content: {
    old: AwesomeList;
    new: AwesomeList;
  };
  tags: Array<string>;
  update: (updates: Partial<AwesomeList>) => void;
  clear: () => void;
  syncRemoteList: (newList: AwesomeList) => void;
  hasUnsavedChanges: boolean;
  isWorkflowRunning: boolean;
  canEdit: boolean;
  isLoading: boolean;
  error: string | null;
}

const ListContext = createContext<ListContextType | undefined>(undefined);

export const useList = () => {
  const context = useContext(ListContext);
  if (!context) {
    throw new Error("useList must be used within a ListProvider");
  }
  return context;
};

export const ListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const githubAuth = useGitHubAuth();
  const queryClient = useQueryClient();

  const {
    data: changes,
    setData: setChanges,
    clearData: clearPersistedChanges,
  } = useCommitAwareStorage<Partial<AwesomeList>>(
    "awesome-list-changes",
    __CONFIGURATION__.repository.commit,
    {},
  );

  const github = useRepositoryService();

  const enabled = Boolean(
    githubAuth.isAuthenticated && githubAuth.token,
  );

  const {
    data: remoteList,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["awesome-list"],
    queryFn: async () => {
      try {
        const file = await github.read(__CONFIGURATION__.list.path);
        const content = yaml.load(file.content);

        const parsing = AwesomeListSchema.safeParse(content);

        if (parsing.error) throw parsing.error;

        const list = parsing.data;

        try {
          const readmePath = __CONFIGURATION__.list.path.replace(
            /[^/]+$/,
            "README.md",
          );
          const readmeFile = await github.read(readmePath);
          list.readme = readmeFile.content;
        } catch (err) {
          console.warn("Failed to fetch remote README:", err);
          if (list_.readme) {
            list.readme = list_.readme;
          }
        }

        return list;
      } catch (err) {
        console.warn("Failed to fetch remote YAML, using preloaded data:", err);
        return list_;
      }
    },
    enabled,
    initialData: list_,
    retry: (failureCount, _error) => failureCount < 3,
  });

  const baseList = remoteList || list_;
  const list = useMemo<AwesomeList>(() => {
    return { ...baseList, ...changes };
  }, [baseList, changes]);

  const allTags = useMemo(() => {
    return [
      ...new Set(list.elements.flatMap((element) => element.tags)),
    ].sort();
  }, [list]);

  const updateList = async (updates: Partial<AwesomeList>) => {
    setChanges((prev: Partial<AwesomeList>) => ({ ...prev, ...updates }));
  };

  const clearChanges = () => {
    clearPersistedChanges();
  };

  const syncRemoteList = (newList: AwesomeList) => {
    queryClient.setQueryData(["awesome-list"], newList);
    clearPersistedChanges();
  };

  // Check if there are actual changes by comparing the merged list with the base list
  const hasUnsavedChanges = useMemo(() => {
    if (Object.keys(changes).length === 0) return false;

    // Compare each changed field
    for (const key of Object.keys(changes) as Array<keyof AwesomeList>) {
      if (!deepEqual(list[key], baseList[key])) {
        return true;
      }
    }

    return false;
  }, [changes, list, baseList]);

  // const canEdit = !isWorkflowRunning;
  const canEdit = true;
  const error = queryError?.message || null;

  useDocumentTitle(hasUnsavedChanges);
  useDynamicMetadata(list);

  return (
    <ListContext.Provider
      value={{
        content: {
          old: baseList,
          new: list,
        },
        tags: allTags,
        update: updateList,
        clear: clearChanges,
        syncRemoteList,
        hasUnsavedChanges,
        isWorkflowRunning: false,
        canEdit,
        isLoading,
        error,
      }}
    >
      {children}
    </ListContext.Provider>
  );
};
