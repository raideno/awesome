import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo } from "react";

import { AwesomeListSchema } from "shared/types/list";

import type { AwesomeList } from "shared/types/list";

import { useRepository } from "@/contexts/repository";

import * as yaml from "js-yaml";

export interface ListContextType {
  content: {
    new: AwesomeList;
  };
  tags: Array<string>;
  update: (updates: Partial<AwesomeList>) => void;
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
  const repository = useRepository();

  const {
    data: list,
    isLoading,
    error,
  } = useQuery<AwesomeList>({
    queryKey: ["awesome-list", repository.files.new["list.yaml"]],
    initialData: {
      title: "",
      description: "",
      author: "",
      elements: [],
      links: [],
    },
    queryFn: async () => {
      const file = await repository.get("list.yaml");

      if (!file)
        throw new Error("Failed to fetch list.yaml: no content returned");

      const content = yaml.load(file);

      const parsing = AwesomeListSchema.safeParse(content);

      if (parsing.error) throw parsing.error;

      return parsing.data;
    },
  });

  const tags = useMemo<Array<string>>(() => {
    return list
      ? [...new Set(list.elements.flatMap((element) => element.tags))].sort()
      : [];
  }, [list]);

  const update = (updates: Partial<AwesomeList>) => {
    if (!list) return;

    repository.write("list.yaml", yaml.dump({ ...list, ...updates }));
  };

  return (
    <ListContext.Provider
      value={{
        content: {
          new: list
        },
        tags,
        update,
        isLoading,
        error: error instanceof Error ? error.message : error ? String(error) : null,
      }}
    >
      {children}
    </ListContext.Provider>
  );
};
