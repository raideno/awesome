import fs from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";

export interface RepositoryVirtualModule {
  /** Files that were bundled at build time: relativePath → content. */
  bundled: Record<string, string>;
  /** Base URL under which all repository files are served, e.g. "/repository". */
  baseUrl: string;
}

export interface RepositoryPluginOptions {
  /**
   * Absolute or relative path to the source repository directory whose
   * contents should be made available at runtime.
   */
  path: string;

  /**
   * Glob patterns (relative to `repositoryPath`) for files that are bundled
   * directly into the JS module at build time and resolved synchronously from
   * the virtual module.  Every other file is only copied to
   * `public/repository` and must be fetched at runtime.
   *
   * Both plain file names and glob patterns are supported.
   *
   * @example ["README.md", "awesome.yaml", "storage/*", "data/**\/*.json"]
   */
  files?: Array<string>;

  /**
   * Patterns **or** sub-directory names to exclude from both bundling and the
   * public copy.  Each entry is matched against the relative path of a file
   * as well as every individual path segment, so a bare name like
   * `"node_modules"` will prune the entire directory.
   *
   * @example [".git", "node_modules", ".DS_Store"]
   */
  ignore?: Array<string>;

  /**
   * Name of the sub-folder created inside `public/` that will hold the copied
   * repository files.  Defaults to `"repository"`.
   *
   * Override this to a git-ignored name (e.g. `".repository"`) so the copied
   * files are never accidentally committed to your repository.
   *
   * @default "repository"
   */
  publicSubdir?: string;
}

/**
 * Recursively walks `dir`, yielding paths relative to `baseDir`.
 * Entries whose relative path (or any ancestor segment) matches `ignoreSet`
 * are skipped entirely.
 */
function* walk(
  dir: string,
  baseDir: string,
  ignoreSet: Set<string>,
): Generator<string> {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.relative(baseDir, path.join(dir, entry.name));

    if (shouldIgnore(relativePath, ignoreSet)) continue;

    if (entry.isDirectory()) {
      yield* walk(path.join(dir, entry.name), baseDir, ignoreSet);
    } else if (entry.isFile()) {
      yield relativePath;
    }
  }
}

const shouldIgnore = (relativePath: string, ignoreSet: Set<string>): boolean => {
  if (ignoreSet.has(relativePath)) return true;

  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (ignoreSet.has(part)) return true;
  }

  return false;
};

/**
 * Expands an array of glob patterns (relative to `sourceDir`) into a
 * deduplicated set of concrete relative file paths that actually exist on
 * disk.  Patterns without glob characters are treated as literals and
 * included only when the file exists.
 *
 * Paths that match `ignoreSet` are filtered out after expansion.
 */
const resolveBundledPatterns = (
  sourceDir: string,
  patterns: Array<string>,
  ignoreSet: Set<string>,
): Set<string> => {
  const resolved = new Set<string>();

  for (const pattern of patterns) {
    // Normalise to forward slashes — globSync always uses them.
    const normPattern = pattern.split(path.sep).join("/");

    const matches = fs.globSync(normPattern, {
      cwd: sourceDir,
    }).filter((match) => {
      const abs = path.join(sourceDir, match);
      return fs.statSync(abs).isFile();
    });

    for (const match of matches) {
      // Normalise back to the OS separator for consistent map keys.
      const relativePath = match.split("/").join(path.sep);

      if (!shouldIgnore(relativePath, ignoreSet)) {
        resolved.add(relativePath);
      }
    }
  }

  return resolved;
};

/**
 * Returns `true` when `relativePath` is matched by at least one of the
 * provided glob `patterns`.  Used in the HMR watcher to decide whether a
 * changed file is part of the bundled set without re-expanding every pattern.
 */
const matchesBundledPattern = (
  relativePath: string,
  patterns: Array<string>,
  sourceDir: string,
): boolean => {
  // Normalise to forward slashes for globSync.
  const normRelative = relativePath.split(path.sep).join("/");

  for (const pattern of patterns) {
    const normPattern = pattern.split(path.sep).join("/");

    const matches = fs.globSync(normPattern, {
      cwd: sourceDir,
    }).filter((match) => {
      const abs = path.join(sourceDir, match);
      return fs.existsSync(abs) && fs.statSync(abs).isFile();
    });

    if (matches.some((m) => m.split(path.sep).join("/") === normRelative)) {
      return true;
    }
  }

  return false;
};

/**
 * Copies all files from `sourceDir` to `destDir`, recreating the directory
 * tree, skipping anything in `ignoreSet`.
 */
const copyRepositoryToPublic = (
  sourceDir: string,
  destDir: string,
  ignoreSet: Set<string>,
  logger: { info: (msg: string) => void },
): void => {
  if (!fs.existsSync(sourceDir)) {
    logger.info(
      `[repository](copy): source directory does not exist, skipping copy: ${sourceDir}`,
    );
    return;
  }

  let count = 0;

  for (const relativePath of walk(sourceDir, sourceDir, ignoreSet)) {
    const srcFile = path.join(sourceDir, relativePath);
    const destFile = path.join(destDir, relativePath);

    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);

    count++;
  }

  logger.info(`[repository](copy): copied ${count} file(s) → ${destDir}`);
};

/**
 * Resolves all `bundledFiles` patterns against `sourceDir` and reads each
 * matched file, returning a map of relative path → file content string.
 */
const readBundledFiles = (
  sourceDir: string,
  bundledFiles: Array<string>,
  ignoreSet: Set<string>,
): Record<string, string> => {
  const result: Record<string, string> = {};

  const resolvedPaths = resolveBundledPatterns(sourceDir, bundledFiles, ignoreSet);

  for (const relativePath of resolvedPaths) {
    const absPath = path.join(sourceDir, relativePath);

    if (!fs.existsSync(absPath)) continue;

    result[relativePath] = fs.readFileSync(absPath, "utf8");
  }

  return result;
};

export const loadRepository = (
  repositoryPath: string | undefined,
  bundledFiles: Array<string> = [],
  ignore: Array<string> = [],
): Record<string, string> => {
  if (!repositoryPath || !fs.existsSync(repositoryPath)) return {};

  const ignoreSet = new Set(ignore);

  return readBundledFiles(repositoryPath, bundledFiles, ignoreSet);
};

export default (options: RepositoryPluginOptions): Plugin => {
  const {
    path: repositoryPath,
    files: bundledFiles = [],
    ignore = [],
    publicSubdir = "repository",
  } = options;

  const virtualModuleId = "virtual:repository";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  /** Sub-folder inside `public/` where repository files are served from. */
  const PUBLIC_SUBDIR = publicSubdir;

  const ignoreSet = new Set(ignore);

  let resolvedConfig: ResolvedConfig;

  // Resolved absolute paths — set once in configResolved.
  let absRepositoryPath: string;
  let absPublicDestDir: string;

  return {
    name: "repository",
    enforce: "pre",

    configResolved(config) {
      resolvedConfig = config;

      absRepositoryPath = path.resolve(config.root, repositoryPath);
      absPublicDestDir = path.resolve(config.publicDir, PUBLIC_SUBDIR);

      config.logger.info(`[repository](source): ${absRepositoryPath}`);
      config.logger.info(`[repository](public): ${absPublicDestDir}`);
      config.logger.info(
        `[repository](bundled): ${bundledFiles.length} pattern(s) configured for inline bundling`,
      );

      if (ignore.length > 0) {
        config.logger.info(`[repository](ignore): ${ignore.join(", ")}`);
      }
    },

    // -------------------------------------------------------------------------
    // buildStart — copy repository files into public/ so they are served at
    // runtime under /repository/<relative-path>.
    // -------------------------------------------------------------------------
    buildStart() {
      const logger = {
        info: (msg: string) =>
          resolvedConfig?.logger.info(msg) ?? console.log(msg),
      };

      copyRepositoryToPublic(absRepositoryPath, absPublicDestDir, ignoreSet, logger);
    },

    // -------------------------------------------------------------------------
    // configureServer — also copy in dev mode and watch for changes.
    // -------------------------------------------------------------------------
    configureServer(server) {
      const logger = {
        info: (msg: string) => server.config.logger.info(msg),
      };

      // Initial copy when dev server starts.
      copyRepositoryToPublic(absRepositoryPath, absPublicDestDir, ignoreSet, logger);

      if (!fs.existsSync(absRepositoryPath)) return;

      server.watcher.add(absRepositoryPath);

      server.watcher.on("all", (event, filePath) => {
        if (!filePath.startsWith(absRepositoryPath)) return;

        const relative = path.relative(absRepositoryPath, filePath);
        if (shouldIgnore(relative, ignoreSet)) return;

        logger.info(
          `[repository](watcher): "${event}" detected on ${filePath}`,
        );

        // Re-copy the changed file to the public directory.
        if (event === "add" || event === "change") {
          const destFile = path.join(absPublicDestDir, relative);
          fs.mkdirSync(path.dirname(destFile), { recursive: true });
          fs.copyFileSync(filePath, destFile);
        } else if (event === "unlink") {
          const destFile = path.join(absPublicDestDir, relative);
          if (fs.existsSync(destFile)) fs.rmSync(destFile);
        }

        // If the changed file is matched by any bundled pattern, invalidate
        // the virtual module so HMR picks up the new content.
        if (matchesBundledPattern(relative, bundledFiles, absRepositoryPath)) {
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }

          server.ws.send({ type: "full-reload" });
        }
      });
    },

    // -------------------------------------------------------------------------
    // Virtual module — `import repository from "virtual:repository"`
    //
    // Shape:
    // {
    //   bundled: Record<string, string>;   // relativePath → content (inline)
    //   baseUrl: string;                   // e.g. "/repository"
    // }
    // -------------------------------------------------------------------------
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id) {
      if (id !== resolvedVirtualModuleId) return;

      const absPath = path.resolve(
        resolvedConfig?.root ?? process.cwd(),
        repositoryPath,
      );

      const bundled = readBundledFiles(absPath, bundledFiles, ignoreSet);

      console.log(
        `[repository](load): bundled ${Object.keys(bundled).length} file(s) from "${absPath}"`,
      );

      return [
        `const bundled = ${JSON.stringify(bundled)};`,
        `const baseUrl = ${JSON.stringify(`/${PUBLIC_SUBDIR}`)};`,
        `export default { bundled, baseUrl };`,
      ].join("\n");
    },
  };
};
