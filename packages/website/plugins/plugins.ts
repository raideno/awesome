import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

import type { Plugin, ResolvedConfig } from "vite";

/**
 * Extracts npm package names from static import / export statements and
 * dynamic import() calls in a source file.
 *
 * Handles:
 *   - bare specifiers:              "react", "sonner"
 *   - scoped specifiers:            "@radix-ui/themes"
 *   - sub-path imports:             "@uiw/react-md-editor"
 *   - CSS side-effect imports:      "katex/dist/katex.min.css"
 *
 * Ignores:
 *   - relative / absolute paths:   "./foo", "../bar", "/baz"
 *   - Node built-ins:              "node:fs", "fs", "path", …
 *   - virtual modules:             "virtual:…", "\0…"
 */
const extractPackageNames = (source: string): Array<string> => {
  const specifiers = new Set<string>();

  // Match both static and dynamic import strings.
  // We keep it simple with a regex — no need for a full AST here.
  const importRe =
    /(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\()['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    const specifier = match[1];

    // Skip relative / absolute paths
    if (specifier.startsWith(".") || specifier.startsWith("/")) continue;

    // Skip Node built-ins (both "node:x" and legacy bare names)
    if (specifier.startsWith("node:")) continue;

    // Skip virtual Vite modules
    if (specifier.startsWith("virtual:") || specifier.startsWith("\0")) continue;

    // Extract the package name (strip sub-path after first "/", but keep
    // the scope prefix for scoped packages like "@scope/pkg").
    let packageName: string;
    if (specifier.startsWith("@")) {
      // "@scope/name/sub/path" → "@scope/name"
      const parts = specifier.split("/");
      if (parts.length < 2) continue;
      packageName = `${parts[0]}/${parts[1]}`;
    } else {
      // "name/sub/path" → "name"
      packageName = specifier.split("/")[0];
    }

    specifiers.add(packageName);
  }

  return [...specifiers];
};

/** Node built-in module names (non-exhaustive but covers the common ones). */
const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring",
  "readline", "repl", "stream", "string_decoder", "sys", "timers", "tls",
  "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads",
  "zlib",
]);

/**
 * Reads workspace package names from the monorepo root package.json so we can
 * skip them — they are resolved by Vite aliases / npm workspaces and are never
 * published to the npm registry.
 *
 * Walk upward from `startDir` until we find a package.json that has a
 * "workspaces" field (= the monorepo root), then collect all workspace package
 * names by reading the name field of each workspace's own package.json.
 */
const getWorkspacePackageNames = (startDir: string): Set<string> => {
  const names = new Set<string>();

  // Walk up to find the workspace root
  let dir = startDir;
  let rootPkgJson: { workspaces?: Array<string>; name?: string } | null = null;
  let rootDir = dir;

  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (parsed.workspaces) {
          rootPkgJson = parsed;
          rootDir = dir;
          break;
        }
      } catch {
        // ignore parse errors
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (!rootPkgJson?.workspaces) return names;

  // Expand each workspace glob pattern and read the package name from each
  // workspace's package.json.
  for (const pattern of rootPkgJson.workspaces) {
    const matched = fs.globSync(path.join(rootDir, pattern));
    for (const wsDir of matched) {
      const pkgJsonPath = path.join(wsDir, "package.json");
      if (!fs.existsSync(pkgJsonPath)) continue;
      try {
        const { name } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        if (typeof name === "string") names.add(name);
      } catch {
        // ignore
      }
    }
  }

  return names;
};

/**
 * Returns true when `packageName` can already be resolved from `fromDir`.
 */
const isResolvable = (packageName: string, fromDir: string): boolean => {
  if (NODE_BUILTINS.has(packageName)) return true;

  try {
    const require = createRequire(path.join(fromDir, "__probe__.js"));
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
};

/**
 * Installs `packages` into the nearest node_modules without modifying any
 * package.json file (`--no-save`).  The install is run synchronously so that
 * Vite's module resolution sees the packages before it tries to bundle them.
 */
const installPackages = (
  packages: Array<string>,
  cwd: string,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
): void => {
  if (packages.length === 0) return;

  logger.info(
    `[plugins](deps): installing missing package(s): ${packages.join(", ")}`,
  );

  try {
    execSync(`npm install --no-save --no-audit --no-fund ${packages.join(" ")}`, {
      cwd,
      stdio: "pipe",
    });
    logger.info(
      `[plugins](deps): successfully installed: ${packages.join(", ")}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      `[plugins](deps): failed to install ${packages.join(", ")}: ${message}`,
    );
  }
};

/**
 * Given an array of absolute plugin file paths, scans each one for imports,
 * determines which packages are missing, and installs them with --no-save.
 */
const ensurePluginDeps = (
  pluginFilePaths: Array<string>,
  projectRoot: string,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
): void => {
  const missing = new Set<string>();

  // Workspace packages are resolved by Vite aliases / npm workspaces — they
  // are not published on the registry and must never be passed to `npm install`.
  const workspaceNames = getWorkspacePackageNames(projectRoot);

  for (const filePath of pluginFilePaths) {
    let source: string;
    try {
      source = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const packages = extractPackageNames(source);

    for (const pkg of packages) {
      // Skip workspace-local packages (e.g. "shared", "storage-service")
      if (workspaceNames.has(pkg)) continue;

      if (!isResolvable(pkg, projectRoot)) {
        missing.add(pkg);
      }
    }
  }

  installPackages([...missing], projectRoot, logger);
};

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

    buildStart() {
      // NOTE: dependency installation is intentionally NOT done here.
      // Running `npm install` inside a Vite hook mutates node_modules while
      // Vite's build process is actively using it. Vite writes internal chunks
      // with content-hash filenames; if npm rewrites those files mid-build the
      // already-loaded entry chunk can no longer find its sibling chunks,
      // producing "Cannot find module …/dep-Xxxxx.js" errors.
      //
      // Instead, run the `install-plugin-deps` npm script as a dedicated step
      // BEFORE `vite build` in CI (see .github/workflows/build.yaml).
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

        // When a plugin file is added or changed, re-check its deps so that
        // newly required packages get installed without restarting the dev server.
        if (event === "add" || event === "change") {
          ensurePluginDeps([filePath], server.config.root, {
            info: (msg) => server.config.logger.info(msg),
            warn: (msg) => server.config.logger.warn(msg),
          });
        }

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
