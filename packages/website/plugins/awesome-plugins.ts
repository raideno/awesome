import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type PluginDefinition,
  PluginDefinitionSchema,
} from "shared/types/plugins";

import type { Plugin, ResolvedConfig } from "vite";

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
    path.join(pluginsDirectoryPath, "*.plugin.{ts,js,tsx,jsx}"),
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

  let resolvedConfig: ResolvedConfig;

  return {
    name: "plugins",
    enforce: "pre",

    async configResolved(config) {
      resolvedConfig = config;
      const plugins = await validatePluginsDirectory(pluginsDirectoryPath);

      console.log(`[plugins](loaded): ${plugins.length} plugin(s) loaded.`);

      if (pluginsDirectoryPath) {
        const absPath = path.resolve(config.root, pluginsDirectoryPath);
        config.logger.info(`[plugins](watching): ${absPath}`);
      }
    },
    configureServer(server) {
      if (!pluginsDirectoryPath) return;

      const absPluginsDir = path.resolve(server.config.root, pluginsDirectoryPath);

      if (!fs.existsSync(absPluginsDir)) return;

      server.httpServer?.once("listening", () => {
        const mod = server.moduleGraph.getModuleById("\0virtual:plugins");
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      });

      server.watcher.add(absPluginsDir);

      server.watcher.on("all", (event, filePath) => {
        if (!filePath.startsWith(absPluginsDir)) return;
        if (!/\.plugin\.(ts|js|tsx|jsx)$/.test(filePath)) return;

        console.log(`[plugins](watcher): "${event}" detected on ${filePath}, invalidating virtual module.`);

        const mod = server.moduleGraph.getModuleById("\0virtual:plugins");
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }

        server.ws.send({ type: "full-reload" });
      });
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        if (!pluginsDirectoryPath) {
          return `export default [];`;
        }

        const absPluginsDir = path.resolve(resolvedConfig?.root ?? process.cwd(), pluginsDirectoryPath);

        console.log(`[plugins](load): resolving plugins from "${absPluginsDir}"`);

        if (!fs.existsSync(absPluginsDir)) {
          return `export default [];`;
        }

        const pluginFilePaths = fs.globSync(
          path.join(absPluginsDir, "*.plugin.{ts,js,tsx,jsx}"),
        );

        console.log(`[plugins](load): found ${pluginFilePaths.length} plugin file(s):`, pluginFilePaths);

        const importLines = pluginFilePaths.map(
          (filePath, i) => `import plugin_${i} from ${JSON.stringify(filePath)};`,
        );
        const exportItems = pluginFilePaths.map((_, i) => `plugin_${i}`).join(", ");

        return [
          ...importLines,
          `export default [${exportItems}];`,
        ].join("\n");
      }
    },
  };
};
