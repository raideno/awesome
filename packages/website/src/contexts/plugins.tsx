// @ts-ignore: idk
import plugins_ from "virtual:plugins";
// @ts-ignore: idk
import buildTimeStorage from "virtual:plugin-storage";

import { toast } from "sonner";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import type {
  PluginDefinition,
  PluginContext,
  PluginStateAdapter,
  PluginContextSetup,
} from "shared/types/plugins";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { experimental_streamedQuery as streamedQuery } from "@tanstack/react-query";

import { useGitHubAuth } from "@/hooks/github-auth";
import { useCommitAwareStorage } from "@/hooks/commit-aware-storage";
import { useRepositoryService } from "@/hooks/repository-service";
import { useList } from "@/contexts/list";

/**
 * Staged plugin storage — a map of pluginId → filename → content.
 * Changes are accumulated here and pushed to GitHub via the push-changes dialog.
 */
export type StagedPluginStorage = Record<string, Record<string, string>>;

export interface PluginsContextType {
  plugins: Array<PluginDefinition>;
  /**
   * Returns the context object for a given plugin id.
   * Throws if the plugin doesn't exist or failed to initialize.
   */
  context: (id: string) => PluginContext;
  isLoading: boolean;
  ready: Array<string>;
  error: Error | null;
  storage: {
    staged: {
      /**
       * All pending storage writes that have not yet been committed to the repository.
       */
      content: StagedPluginStorage;
      /**
       * Whether any plugin has uncommitted storage changes.
       */
      has: boolean;
      /**
       * Clears all staged plugin storage changes without committing them.
       */
      clear: () => void;
      /**
       * Called after a successful push to mark the staged state as clean.
       */
      sync: () => void;
    };
  };
}

/**
 * A snapshot of all registered adapters across all plugins.
 * Shape: pluginId → key → adapter
 *
 * Stored in React state so that components calling a `use()` hook returned by
 * `setup.register()` re-render when the snapshot reference changes (i.e. when
 * any adapter calls its setter).
 */
type AdapterSnapshot = Record<string, Record<string, PluginStateAdapter>>;

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

/**
 * Holds the latest adapter snapshot. Plugin components subscribe to this
 * context through the `use` hook returned by `setup.register()`, so they
 * re-render only when an adapter value changes — independently of the heavier
 * PluginsContext.
 */
const PluginAdapterContext = createContext<AdapterSnapshot>({});

export const usePlugins = () => {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error("usePlugins must be used within a PluginsProvider");
  return ctx;
};

const storagePathFor = (pluginId: string, filename: string) =>
  `${__CONFIGURATION__.storage.path}/${pluginId}/${filename}`;

const storageDirFor = (pluginId: string) =>
  `${__CONFIGURATION__.storage.path}/${pluginId}`;

export const PluginsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const plugins = plugins_ as Array<PluginDefinition>;
  const githubAuth = useGitHubAuth();
  const queryClient = useQueryClient();
  const list = useList();

  const {
    data: stagedStorage,
    setData: setStagedStorage,
    clearData: clearStagedStorage,
  } = useCommitAwareStorage<StagedPluginStorage>(
    "plugin-storage-changes",
    __CONFIGURATION__.repository.commit,
    {},
  );

  const github = useRepositoryService();

  // Ref so that storage closures captured inside the query (which only
  // re-runs on token changes) always read the latest staged data.
  const stagedStorageRef = useRef(stagedStorage);
  stagedStorageRef.current = stagedStorage;

  // ---------------------------------------------------------------------------
  // Adapter snapshot — updated whenever a plugin calls adapter.set()
  // ---------------------------------------------------------------------------

  const [adapterSnapshot, setAdapterSnapshot] = useState<AdapterSnapshot>({});

  // Ref so that setup.register() closures always see the latest snapshot
  // without needing to be re-created on every render.
  const adapterSnapshotRef = useRef(adapterSnapshot);
  adapterSnapshotRef.current = adapterSnapshot;

  // ---------------------------------------------------------------------------
  // Storage factory
  // ---------------------------------------------------------------------------

  const makeStorage = useCallback(
    (pluginId: string): PluginContext["storage"] => {
      const read = async (filename: string): Promise<string> => {
        if (stagedStorageRef.current[pluginId]?.[filename] !== undefined) {
          return stagedStorageRef.current[pluginId][filename];
        }

        try {
          const file = await github.read(storagePathFor(pluginId, filename));
          return file.content;
        } catch {}

        return buildTimeStorage?.[pluginId]?.[filename] ?? "";
      };

      const write = async (filename: string, content: string): Promise<void> => {
        setStagedStorage((prev) => ({
          ...prev,
          [pluginId]: { ...(prev[pluginId] ?? {}), [filename]: content },
        }));
      };

      const list = async (): Promise<Array<string>> => {
        const staged = Object.keys(stagedStorageRef.current[pluginId] ?? {});

        try {
          const entries = await github.list(storageDirFor(pluginId));
          const remote = entries
            .filter((e) => e.type === "file")
            .map((e) => e.name);
          return [...new Set([...remote, ...staged])];
        } catch {}

        const buildTime = Object.keys(buildTimeStorage?.[pluginId] ?? {});
        return [...new Set([...buildTime, ...staged])];
      };

      return { read, write, list };
    },
    [github, setStagedStorage],
  );

  // ---------------------------------------------------------------------------
  // Setup factory — handed to the plugin's createContext so it can register
  // its own state adapters. The framework wraps each adapter's setter so that
  // calling it bumps the React snapshot and triggers re-renders.
  // ---------------------------------------------------------------------------

  const makeSetup = useCallback(
    (pluginId: string): PluginContextSetup => ({
      register: <T,>(key: string, adapter: PluginStateAdapter<T>) => {
        // Wrap the plugin's setter: call the original, then bump the snapshot
        // so React re-renders any component holding the returned `use` hook.
        const wrappedSet = (value: T) => {
          adapter.set(value);
          setAdapterSnapshot((prev) => ({
            ...prev,
            [pluginId]: {
              ...(prev[pluginId] ?? {}),
              // Store a wrapped adapter so the context value is a new reference.
              [key]: { get: adapter.get, set: wrappedSet } as PluginStateAdapter,
            },
          }));
        };

        // Register immediately so the adapter is available before first render.
        setAdapterSnapshot((prev) => ({
          ...prev,
          [pluginId]: {
            ...(prev[pluginId] ?? {}),
            [key]: { get: adapter.get, set: wrappedSet } as PluginStateAdapter,
          },
        }));

        // Return a React hook the plugin can embed in its components.
        const use = (): [T, (value: T) => void] => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useContext(PluginAdapterContext); // subscribe to snapshot changes
          return [adapter.get() as T, wrappedSet];
        };

        return use;
      },
    }),
    [],
  );

  // ---------------------------------------------------------------------------
  // Plugin initialisation query
  // ---------------------------------------------------------------------------

  const { isLoading, error, data } = useQuery<
    Array<{ pluginId: string; context: PluginContext }>
  >({
    queryKey: ["plugins", githubAuth.token],
    initialData: [],
    queryFn: streamedQuery({
      streamFn: async () => {
        async function* initPlugins() {
          for (const plugin of plugins) {
            try {
              const context: PluginContext = {
                plugin,
                toast,
                list,
                storage: makeStorage(plugin.id),
              };

              plugin.context?.setup?.(context, makeSetup(plugin.id));

              yield { pluginId: plugin.id, context };
            } catch (err) {
              console.error(`Failed to initialize plugin "${plugin.id}":`, err);
            }
          }
        }

        return initPlugins();
      },
    }),
  });

  const context = (id: string): PluginContext => {
    const pluginContext = data.find((p) => p.pluginId === id)?.context;

    if (!pluginContext) {
      throw new Error(
        `Plugin with id "${id}" not found or failed to initialize.`,
      );
    }

    return pluginContext;
  };

  const hasStagedStorageChanges = Object.keys(stagedStorage).some(
    (pluginId) => Object.keys(stagedStorage[pluginId]).length > 0,
  );

  const syncStagedStorage = () => {
    queryClient.invalidateQueries({ queryKey: ["plugins"] });
    clearStagedStorage();
  };

  return (
    <PluginAdapterContext.Provider value={adapterSnapshot}>
      <PluginsContext.Provider
        value={{
          ready: data.map((p) => p.pluginId),
          plugins: plugins_,
          context,
          isLoading,
          error,
          storage: {
            staged: {
              content: stagedStorage,
              has: hasStagedStorageChanges,
              sync: syncStagedStorage,
              clear: clearStagedStorage,
            },
          },
        }}
      >
        {children}
      </PluginsContext.Provider>
    </PluginAdapterContext.Provider>
  );
};
