// @ts-ignore: idk
// @ts-ignore: idk
import plugins_ from "virtual:plugins";

import { toast } from "sonner";
import React, { createContext, useContext } from "react";

import type { PluginDefinition, PluginContext } from "shared/types/plugins";
import { useQuery } from "@tanstack/react-query";

/**
 * We have multiple options when it comes to installation of plugins, given the list of plugins:
 * - Save the url of the plugin into the list.yaml, at each build we download the plugin and buundle it into the website.
 *   This is a bit problematic as plugins might change over time and users will have different versions each time they update their website's content and a new build tirggers.
 *   Plus it might introduce security issues as a plugin that was originally safe might become malicious after some time, and users that update their website's content will automatically get the malicious version without being aware of it.
 * - Save plugin's code on installation when install is clicked, we commit the plugin's code/file into the repository which will ensure it'll be fetched and loaded during next build and thus make it available.
 *   We need some vite plugin that'll be given a directory where plugins leave and the vite plugin will automatically load all of them, verify they're valid and make the available in the website.
 */

 /**
  * Ok so now when it comes to plugin's access to libraries, plugins should have access to the libraries installed in the website, such as radix-ui, autoform, etc.
  * It should also be possible for plugins to declare their own dependencies.
  * Maybe plugins should be a full blown npm package like with a package.json file ?
  *
  * For now we're ignoring this, plugins won't have access to any package.
  */

export interface PluginsContextType {
  plugins: Array<PluginDefinition>;
  /**
   *
   * @param id The pluginId.
   * @returns A context object specific to the plugin with the given id, or an error if the plugin doesn't exist or if there was an issue while creating the context.
   */
  context: (id: string) => PluginContext;
  isLoading: boolean;
  ready: Array<string>;
  error: Error | null;
}

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

export const usePlugins = () => {
  const context = useContext(PluginsContext);
  if (!context) {
    throw new Error("usePlugins must be used within a PluginsProvider");
  }
  return context;
};

export const PluginsProvider: React.FC<{ children: React.ReactNode, blocking?: boolean }> = ({
  children,
  blocking = false
}) => {
  const plugins = plugins_ as Array<PluginDefinition>;

  const [ready, setReady] = React.useState<Array<string>>([]);
  const [contexts, setContexts] = React.useState<Map<string, PluginContext>>(new Map());

  /**
   * As a first plugin, we'll have only an action sidebar extension.
   */
  /**
   * [ ] Add a plugins directory parameter to the website build. Default value being ./plugins.
   * [ ] Make a vite plugin to load these plugins and verify them against the PluginDefinition schema, rewrite it correctly in zod.
   * [ ] Provide these plugins in a glboal. They'll be accessible everywhere.
   */

   /**
    * In this plugins context, we'll manage the part for installing new plugins.
    * [ ] Accept a repository link.
    * [ ] Fetch plugins there.
    * [ ] Install a plugin from a file link or a file by committing it. Plugin filename will be its id.
    */

  const { data, isLoading, error } = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => {
      return await Promise.all(
        plugins.map(async (plugin) => {
          try {
            const context: PluginContext = {
              plugin: plugin,
              toast: toast,
              storage: {
                read: async (name: string) => "",
                write: async (name: string, content: string) => { },
                list: async () => []
              }
            };

            setReady((prev) => [...prev, plugin.id]);
            setContexts((prev) => new Map(prev).set(plugin.id, context));

            return {
              pluginId: plugin.id,
              context,
            }
          } catch (error) {
            console.error(`Failed to initialize plugin "${plugin.id}":`, error);
          }
        }),
      );
    },
  });

  const context = (id: string): PluginContext => {
    if (!contexts)
      throw new Error("Plugins are still loading. Please wait until they're loaded to access their context.");

    // const pluginContext = data.find((p) => p?.pluginId === id)?.context;

    const pluginContext = contexts.get(id);

    console.log(contexts, ready)

    if(!pluginContext) {
      throw new Error(`Plugin with id "${id}" not found or failed to initialize.`);
    }

    return pluginContext;
  };

  /**
   * TODO: do some nice loading screen with some loading for each extension.
   * Or we can just wrap the places were there is an extension that requires loading with some <WhenPluginsLoaded> component that will show a loading screen until the plugins are loaded, and then show the extension.
   */
  if (blocking)
    if (isLoading)
      return <div>Loading plugins...</div>;

  return (
    <PluginsContext.Provider
      value={{
        ready: ready,
        plugins: plugins_,
        context: context,
        isLoading: isLoading,
        error: error,
      }}
    >
      {children}
    </PluginsContext.Provider>
  );
};
