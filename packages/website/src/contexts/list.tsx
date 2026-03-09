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

const EMPTY_LIST: AwesomeList = {
  title: "",
  description: "",
  author: "",
  elements: [],
  links: [],
};

export const ListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const repository = useRepository();

  const { list, error } = useMemo<{ list: AwesomeList; error: string | null }>(() => {
    const raw = repository.files.new["list.yaml"];

    if (!raw) return { list: EMPTY_LIST, error: null };

    try {
      const content = yaml.load(raw);
      const parsing = AwesomeListSchema.safeParse(content);

      if (parsing.error) return { list: EMPTY_LIST, error: parsing.error.message };

      return { list: parsing.data, error: null };
    } catch (e) {
      return { list: EMPTY_LIST, error: e instanceof Error ? e.message : String(e) };
    }
  }, [repository.files.new["list.yaml"]]);

  const tags = useMemo<Array<string>>(() => {
    return [...new Set(list.elements.flatMap((element) => element.tags))].sort();
  }, [list]);

  const update = (updates: Partial<AwesomeList>) => {
    repository.write("list.yaml", yaml.dump({ ...list, ...updates }));
  };

  return (
    <ListContext.Provider
      value={{
        content: {
          new: list,
        },
        tags,
        update,
        isLoading: false,
        error,
      }}
    >
      {children}
    </ListContext.Provider>
  );
};
