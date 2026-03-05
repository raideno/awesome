import fs from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";

/**
 * Scans the plugins directory for plugin files and returns their paths.
 * Full module validation (schema, imports, etc.) is deferred to Vite's
 * module pipeline — we cannot Node-import plugin files directly because
 * they may contain browser-only imports (CSS, JSX, etc.).
 */
export const loadPlugins = (
  pluginsDirectoryPath?: string,
): Array<string> => {
  if (!pluginsDirectoryPath) {
    return [];
  }

  if (!fs.existsSync(pluginsDirectoryPath)) {
    throw new Error(
      `Plugins directory path doesn't exist. At: ${pluginsDirectoryPath}`,
    );
  }

  return fs.globSync(
    path.join(pluginsDirectoryPath, "*.plugin.{ts,js,tsx,jsx}"),
  );
};

export default (pluginsDirectoryPath?: string): Plugin => {
  const virtualModuleId = "virtual:plugins";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  let resolvedConfig: ResolvedConfig;

  return {
    name: "plugins",
    enforce: "pre",

    configResolved(config) {
      resolvedConfig = config;

      const pluginFiles = loadPlugins(pluginsDirectoryPath);
      console.log(`[plugins](loaded): ${pluginFiles.length} plugin(s) found.`);

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
        const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      });

      server.watcher.add(absPluginsDir);

      server.watcher.on("all", (event, filePath) => {
        if (!filePath.startsWith(absPluginsDir)) return;
        if (!/\.plugin\.(ts|js|tsx|jsx)$/.test(filePath)) return;

        console.log(
          `[plugins](watcher): "${event}" detected on ${filePath}, invalidating virtual module.`,
        );

        const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
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

    load(id) {
      if (id === resolvedVirtualModuleId) {
        if (!pluginsDirectoryPath) {
          return `export default [];`;
        }

        const absPluginsDir = path.resolve(
          resolvedConfig?.root ?? process.cwd(),
          pluginsDirectoryPath,
        );

        console.log(`[plugins](load): resolving plugins from "${absPluginsDir}"`);

        if (!fs.existsSync(absPluginsDir)) {
          return `export default [];`;
        }

        const pluginFilePaths = fs.globSync(
          path.join(absPluginsDir, "*.plugin.{ts,js,tsx,jsx}"),
        );

        console.log(
          `[plugins](load): found ${pluginFilePaths.length} plugin file(s):`,
          pluginFilePaths,
        );

        const importLines = pluginFilePaths.map(
          (filePath, i) => `import plugin_${i} from ${JSON.stringify(filePath)};`,
        );
        const exportItems = pluginFilePaths.map((_, i) => `plugin_${i}`).join(", ");

        return [...importLines, `export default [${exportItems}];`].join("\n");
      }
    },
  };
};
