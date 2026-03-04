import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type PluginDefinition,
  PluginDefinitionSchema,
} from "shared/types/plugins";

import type { Plugin } from "vite";

/**
 * TODO: when parsing the js file, detect the package imports that are used, if there is any import to the file system or to any library that isn't used.
 * return an error / warning and ignore the plugin or crash the build.
 * TODO: same thing should be done while installing a plugin, as we currently don't accept new packages.
 */
export const loadPlugins = async (
  pluginsDirectoryPath?: string,
): Promise<Array<PluginDefinition>> => {
  if (!pluginsDirectoryPath) {
    return [];
  }

  if (!fs.existsSync(pluginsDirectoryPath)) {
    throw new Error(
      `Plugins directory path doesn't exist. At: ${pluginsDirectoryPath}`,
    );
  }

  const pluginFilePaths = fs.globSync(
    path.join(pluginsDirectoryPath, "*.plugin.{ts,js}"),
  );

  const plugins: Array<PluginDefinition> = [];

  for (const pluginFilePath of pluginFilePaths) {
    try {
      const fileUrl = pathToFileURL(pluginFilePath).href;

      const importedModule = await import(fileUrl);
      const pluginCandidate = importedModule?.default;

      if (!pluginCandidate) {
        throw new Error(
          `Plugin at "${pluginFilePath}" does not have a default export.`,
        );
      }

      const validationResult =
        PluginDefinitionSchema.safeParse(pluginCandidate);

      if (!validationResult.success) {
        throw new Error(
          `Invalid plugin definition at "${pluginFilePath}":\n${validationResult.error.message}`,
        );
      }

      plugins.push(validationResult.data);
    } catch (error) {
      throw new Error(
        `Failed to load plugin at "${pluginFilePath}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return plugins;
};

const validatePluginsDirectory = (pluginsDirectoryPath?: string) => {
  return loadPlugins(pluginsDirectoryPath);
};

export default (pluginsDirectoryPath?: string): Plugin => {
  const virtualModuleId = "virtual:plugins";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "plugins",
    enforce: "pre",

    async configResolved(config) {
      await validatePluginsDirectory(pluginsDirectoryPath);

      if (pluginsDirectoryPath) {
        const absPath = path.resolve(config.root, pluginsDirectoryPath);
        config.logger.info(`[plugins](watching): ${absPath}`);
      }
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const plugins = await validatePluginsDirectory(pluginsDirectoryPath);
        return `export default ${JSON.stringify(plugins)}`;
      }
    },
  };
};
