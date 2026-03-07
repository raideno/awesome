import fs from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";

export interface RepositoryVirtualModule {
  /** Files that were bundled at build time: relativePath → content. */
  bundled: Record<string, string>;
  /** Base URL under which all repository files are served, e.g. "/repository". */
  baseUrl: string;
}

export interface RepositoryLoadOptions {
  /**
   * Absolute or relative (to cwd) path to the source repository directory
   * whose contents should be made available at runtime.
   */
  path: string;

  /**
   * Glob patterns (relative to `path`) for files that are bundled directly
   * into the JS module at build time and resolved synchronously from the
   * virtual module. Every other file is only copied to `public/repository`
   * and must be fetched at runtime.
   *
   * Both plain file names and glob patterns are supported.
   *
   * @example ["README.md", "list.yaml", "storage/*", "data/**\/*.json"]
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
   * @default "repository"
   */
  publicSubdir?: string;

  /**
   * Optional map of relative file paths to validation functions.
   *
   * Each key is a relative file path (e.g. `"list.yaml"`) and each value is
   * a function that receives the raw string content of that file and either
   * returns a validated/transformed value or throws an error if validation
   * fails.  The returned value is stored in `LoadedRepository.validated` under
   * the same key.
   *
   * Validation runs eagerly inside `repository.load()`, before
   * `vite.defineConfig` is evaluated, so any validation error will abort the
   * build with a clear message.
   *
   * @example
   * ```ts
   * validators: {
   *   "list.yaml": (raw) => {
   *     const data = yaml.load(raw);
   *     return AwesomeListSchema.parse(data);
   *   },
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validators?: Record<string, (raw: string) => any>;
}

export interface RepositoryPluginOptions {
  /**
   * Absolute or relative path to the source repository directory whose
   * contents should be made available at runtime.
   */
  path: string;

  /**
   * Glob patterns (relative to `path`) for files that are bundled
   * directly into the JS module at build time.
   */
  files?: Array<string>;

  /**
   * Patterns **or** sub-directory names to exclude from both bundling and the
   * public copy.
   */
  ignore?: Array<string>;

  /**
   * Name of the sub-folder created inside `public/` that will hold the copied
   * repository files.  Defaults to `"repository"`.
   *
   * @default "repository"
   */
  publicSubdir?: string;
}

/**
 * The object returned by `repository.load()`.
 *
 * - `files`     — raw string contents of every matched bundled file.
 * - `validated` — results of every validator function, keyed by file path.
 * - Pass the whole object to `repository.plugin()`.
 */
export interface LoadedRepository {
  /** Raw file contents keyed by relative path (e.g. `"list.yaml"`). */
  files: Record<string, string>;

  /**
   * Validated / transformed values keyed by relative path.
   * Only populated for files that had a matching entry in `validators`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validated: Record<string, any>;

  /** Resolved absolute path to the repository directory. */
  repositoryPath: string;

  /** Resolved bundled file patterns. */
  bundledFiles: Array<string>;

  /** Ignore list as supplied. */
  ignore: Array<string>;

  /** Public sub-directory name. */
  publicSubdir: string;
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

const shouldIgnore = (
  relativePath: string,
  ignoreSet: Set<string>,
): boolean => {
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

    const matches = fs
      .globSync(normPattern, {
        cwd: sourceDir,
      })
      .filter((match) => {
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

    const matches = fs
      .globSync(normPattern, {
        cwd: sourceDir,
      })
      .filter((match) => {
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

  const resolvedPaths = resolveBundledPatterns(
    sourceDir,
    bundledFiles,
    ignoreSet,
  );

  for (const relativePath of resolvedPaths) {
    const absPath = path.join(sourceDir, relativePath);

    if (!fs.existsSync(absPath)) continue;

    result[relativePath] = fs.readFileSync(absPath, "utf8");
  }

  return result;
};

const load = (options: RepositoryLoadOptions): LoadedRepository => {
  const {
    path: repositoryPath,
    files: bundledFiles = [],
    ignore = [],
    publicSubdir = "repository",
    validators = {},
  } = options;

  const absRepositoryPath = path.resolve(process.cwd(), repositoryPath);
  const ignoreSet = new Set(ignore);

  // Read all bundled files from disk eagerly.
  const files =
    fs.existsSync(absRepositoryPath)
      ? readBundledFiles(absRepositoryPath, bundledFiles, ignoreSet)
      : {};

  // Run validators.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validated: Record<string, any> = {};

  for (const [relativePath, validate] of Object.entries(validators)) {
    const raw = files[relativePath];

    if (raw === undefined) {
      throw new Error(
        `[repository](validate): file "${relativePath}" was listed in validators but was not found among the bundled files.\n` +
          `  Make sure "${relativePath}" is included in the "files" patterns.`,
      );
    }

    try {
      validated[relativePath] = validate(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `[repository](validate): validation failed for "${relativePath}":\n  ${message}`,
        { cause: error },
      );
    }
  }

  return {
    files,
    validated,
    repositoryPath: absRepositoryPath,
    bundledFiles,
    ignore,
    publicSubdir,
  };
};

const plugin = (loaded: LoadedRepository): Plugin => {
  const {
    repositoryPath,
    bundledFiles,
    ignore,
    publicSubdir: PUBLIC_SUBDIR,
  } = loaded;

  const virtualModuleId = "virtual:repository";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

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

      // repositoryPath is already absolute — it was resolved against cwd() in
      // load().  We just assign it directly instead of re-resolving against
      // config.root (which would corrupt the path if it were already absolute).
      absRepositoryPath = repositoryPath;
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

    buildStart() {
      const logger = {
        info: (msg: string) =>
          resolvedConfig?.logger.info(msg) ?? console.log(msg),
      };

      copyRepositoryToPublic(
        absRepositoryPath,
        absPublicDestDir,
        ignoreSet,
        logger,
      );
    },

    configureServer(server) {
      const logger = {
        info: (msg: string) => server.config.logger.info(msg),
      };

      copyRepositoryToPublic(
        absRepositoryPath,
        absPublicDestDir,
        ignoreSet,
        logger,
      );

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
        if (
          matchesBundledPattern(relative, bundledFiles, absRepositoryPath)
        ) {
          const mod = server.moduleGraph.getModuleById(
            resolvedVirtualModuleId,
          );
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }

          server.ws.send({ type: "full-reload" });
        }
      });
    },

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id) {
      if (id !== resolvedVirtualModuleId) return;

      const bundled = readBundledFiles(
        absRepositoryPath,
        bundledFiles,
        ignoreSet,
      );

      resolvedConfig?.logger.info(
        `[repository](load): bundled ${Object.keys(bundled).length} file(s) from "${absRepositoryPath}"`,
      );

      return [
        `const bundled = ${JSON.stringify(bundled)};`,
        `const baseUrl = ${JSON.stringify(`/${PUBLIC_SUBDIR}`)};`,
        `export default { bundled, baseUrl };`,
      ].join("\n");
    },
  };
};

const repository = { load, plugin };

export default repository;
