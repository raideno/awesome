// @ts-ignore: idk
import plugins_ from "virtual:plugins";

import { toast } from "sonner";
import React, {
  createContext,
  useContext,
  useMemo,
} from "react";

import type {
  PluginDefinition,
  PluginContext,
} from "shared/types/plugins";

import { useList } from "@/contexts/list";
import { useRepository } from "@/contexts/repository";

export interface PluginsContextType {
  plugins: Array<PluginDefinition>;
  context: (id: string) => PluginContext;
  isLoading: boolean;
  ready: Array<string>;
  error: Error | null;
}

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

export const usePlugins = () => {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error("usePlugins must be used within a PluginsProvider");
  return ctx;
};

export const PluginsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const plugins = plugins_ as Array<PluginDefinition>;

  const list = useList();
  const repository = useRepository();

  const initialization = useMemo(() => {
    const ready: Array<string> = [];
    const contexts = new Map<string, PluginContext>();
    let error: Error | null = null;

    for (const plugin of plugins) {
      try {
        const context: PluginContext = {
          plugin,
          toast,
          list,
          repository,
        };

        plugin.context?.setup?.(context);

        ready.push(plugin.id);
        contexts.set(plugin.id, context);
      } catch (err) {
        console.error(`Failed to initialize plugin "${plugin.id}":`, err);
        if (!error) {
          error = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    return { ready, contexts, error };
  }, [plugins, list, repository]);

  const pluginsContextValue = useMemo(() => ({
    ready: initialization.ready,
    plugins: plugins_,
    context: (id: string): PluginContext => {
      const pluginContext = initialization.contexts.get(id);

      if (!pluginContext) {
        throw new Error(
          `Plugin with id "${id}" not found or failed to initialize.`,
        );
      }

      return pluginContext;
    },
    isLoading: false,
    error: initialization.error,
  }), [initialization]);

  return (
    <PluginsContext.Provider value={pluginsContextValue}>
      {children}
    </PluginsContext.Provider>
  );
};
