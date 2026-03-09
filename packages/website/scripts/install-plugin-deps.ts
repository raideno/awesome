/**
 * install-plugin-deps.ts
 *
 * Standalone script that scans the user's plugin directory for missing npm
 * dependencies and installs them BEFORE the Vite build starts.
 *
 * This must be run as a separate step prior to `vite build` so that
 * `node_modules` is never mutated while Vite's build process is active.
 * Mutating node_modules mid-build can cause Vite's internal chunk files to
 * become inconsistent (chunks are written with a content hash; if npm rewrites
 * them during the build the already-loaded entry chunk can no longer find its
 * sibling chunks, producing "Cannot find module …/dep-Xxxxx.js" errors).
 *
 * Usage (called automatically via the `predeps` npm script):
 *   NODE_OPTIONS='--import tsx' dotenv -e .env -- node scripts/install-plugin-deps.ts
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Helpers (duplicated from plugins/plugins.ts so this script is self-contained
// and does not pull in Vite at import time).
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Node built-in module names. */
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
 * Extracts npm package names from static / dynamic import statements in a
 * TypeScript/JavaScript source file.
 */
const extractPackageNames = (source: string): Array<string> => {
  const specifiers = new Set<string>();

  const importRe =
    /(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\()['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    const specifier = match[1];

    if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
    if (specifier.startsWith("node:")) continue;
    if (specifier.startsWith("virtual:") || specifier.startsWith("\0")) continue;

    let packageName: string;
    if (specifier.startsWith("@")) {
      const parts = specifier.split("/");
      if (parts.length < 2) continue;
      packageName = `${parts[0]}/${parts[1]}`;
    } else {
      packageName = specifier.split("/")[0];
    }

    specifiers.add(packageName);
  }

  return [...specifiers];
};

/**
 * Walks upward from `startDir` to find the monorepo root (the nearest
 * package.json with a "workspaces" field) and returns all workspace package
 * names so we never try to `npm install` them.
 */
const getWorkspacePackageNames = (startDir: string): Set<string> => {
  const names = new Set<string>();

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

/** Returns true when `packageName` can already be resolved from `fromDir`. */
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(__dirname, "..");

// PLUGINS_DIRECTORY_PATH may be an absolute path or relative to
// REPOSITORY_DIRECTORY_PATH, matching the same logic in vite.config.mts.
const repositoryDir = process.env["REPOSITORY_DIRECTORY_PATH"] ?? "";
const rawPluginsDir = process.env["PLUGINS_DIRECTORY_PATH"];

let pluginsDir: string;
if (!rawPluginsDir) {
  pluginsDir = repositoryDir
    ? path.resolve(repositoryDir, "plugins")
    : path.resolve(projectRoot, "plugins");
} else if (path.isAbsolute(rawPluginsDir)) {
  pluginsDir = rawPluginsDir;
} else {
  pluginsDir = repositoryDir
    ? path.resolve(repositoryDir, rawPluginsDir)
    : path.resolve(projectRoot, rawPluginsDir);
}

console.log(`[install-plugin-deps]: scanning plugins in: ${pluginsDir}`);

if (!fs.existsSync(pluginsDir)) {
  console.log(`[install-plugin-deps]: plugins directory not found, nothing to do.`);
  process.exit(0);
}

const pluginFiles = fs.globSync(
  path.join(pluginsDir, "*.plugin.{ts,js,tsx,jsx}"),
);

if (pluginFiles.length === 0) {
  console.log(`[install-plugin-deps]: no plugin files found, nothing to do.`);
  process.exit(0);
}

console.log(
  `[install-plugin-deps]: found ${pluginFiles.length} plugin file(s):`,
  pluginFiles,
);

const workspaceNames = getWorkspacePackageNames(projectRoot);
const missing = new Set<string>();

for (const filePath of pluginFiles) {
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  for (const pkg of extractPackageNames(source)) {
    if (workspaceNames.has(pkg)) continue;
    if (!isResolvable(pkg, projectRoot)) {
      missing.add(pkg);
    }
  }
}

if (missing.size === 0) {
  console.log(`[install-plugin-deps]: all dependencies already satisfied.`);
  process.exit(0);
}

const packages = [...missing];
console.log(
  `[install-plugin-deps]: installing missing package(s): ${packages.join(", ")}`,
);

try {
  execSync(
    `npm install --no-save --no-audit --no-fund ${packages.join(" ")}`,
    { cwd: projectRoot, stdio: "inherit" },
  );
  console.log(
    `[install-plugin-deps]: successfully installed: ${packages.join(", ")}`,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `[install-plugin-deps]: failed to install packages: ${message}`,
  );
  process.exit(1);
}
