import fs from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";

/**
 * Recursively reads all files under a directory, returning a flat map of
 * relative-path → file-content strings.
 */
const readStorageDirectory = (
  storageDir: string,
): Record<string, Record<string, string>> => {
  if (!fs.existsSync(storageDir)) {
    return {};
  }

  const result: Record<string, Record<string, string>> = {};

  const pluginDirs = fs
    .readdirSync(storageDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const pluginDir of pluginDirs) {
    const pluginId = pluginDir.name;
    const pluginStoragePath = path.join(storageDir, pluginId);

    const files = fs
      .readdirSync(pluginStoragePath, { withFileTypes: true })
      .filter((entry) => entry.isFile());

    result[pluginId] = {};

    for (const file of files) {
      const filePath = path.join(pluginStoragePath, file.name);
      result[pluginId][file.name] = fs.readFileSync(filePath, "utf8");
    }
  }

  return result;
};

export const loadPluginStorage = (
  storageDirectoryPath?: string,
): Record<string, Record<string, string>> => {
  if (!storageDirectoryPath) {
    return {};
  }

  if (!fs.existsSync(storageDirectoryPath)) {
    return {};
  }

  return readStorageDirectory(storageDirectoryPath);
};

export default (storageDirectoryPath?: string): Plugin => {
  const virtualModuleId = "virtual:plugin-storage";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  let resolvedConfig: ResolvedConfig;

  return {
    name: "plugin-storage",
    enforce: "pre",

    configResolved(config) {
      resolvedConfig = config;

      if (storageDirectoryPath) {
        const absPath = path.resolve(config.root, storageDirectoryPath);
        config.logger.info(`[plugin-storage](watching): ${absPath}`);
      }
    },

    configureServer(server) {
      if (!storageDirectoryPath) return;

      const absStorageDir = path.resolve(
        server.config.root,
        storageDirectoryPath,
      );

      if (!fs.existsSync(absStorageDir)) return;

      server.watcher.add(absStorageDir);

      server.watcher.on("all", (event, filePath) => {
        if (!filePath.startsWith(absStorageDir)) return;

        console.log(
          `[plugin-storage](watcher): "${event}" detected on ${filePath}, invalidating virtual module.`,
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
        const absStorageDir = storageDirectoryPath
          ? path.resolve(
              resolvedConfig?.root ?? process.cwd(),
              storageDirectoryPath,
            )
          : undefined;

        console.log(
          `[plugin-storage](load): resolving storage from "${absStorageDir ?? "(none)"}"`,
        );

        const storage = absStorageDir
          ? readStorageDirectory(absStorageDir)
          : {};

        return `export default ${JSON.stringify(storage)};`;
      }
    },
  };
};
