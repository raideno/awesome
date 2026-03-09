import child from "node:child_process";
import path from "node:path";

import * as z from "zod/v4";
import * as vite from "vite";
import * as yaml from "js-yaml";
import { VitePWA } from "vite-plugin-pwa";

import viteReact from "@vitejs/plugin-react";
import plugins from "./plugins/plugins";
import repository from "./plugins/repository";

import { AwesomeListSchema } from "../shared/src/types/list";
import type { AwesomeList } from "../shared/src/types/list";

const EnvironmentSchema = z
  .looseObject({
    BASE: z.string().nonempty(),

    LIST_FILE_PATH: z.string().nonempty().optional().default("list.yaml"),

    PLUGINS_DIRECTORY_PATH: z.string().optional(),

    REPOSITORY_DIRECTORY_PATH: z.string(),
    REPOSITORY_BUNDLED_FILES: z.string().optional().default(""),
    REPOSITORY_IGNORE: z.string().optional().default(""),
    REPOSITORY_PUBLIC_SUBDIR: z.string().optional().default("repository"),

    GITHUB_REPOSITORY_URL: z.string().nonempty(),
    GITHUB_WORKFLOW_REF: z.string().nonempty(),

    USER_REPOSITORY_COMMIT_HASH: z.string().optional().default(""),
    AWESOME_WEBSITE_TAG: z.string().optional().default("unknown"),
  })
  .transform((env) => {
    const [GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_NAME] =
      env.GITHUB_REPOSITORY_URL.split("/").slice(-2);

    const BASE = env.BASE || `/${GITHUB_REPOSITORY_NAME}`;

    const USER_REPOSITORY_COMMIT_HASH =
      env.USER_REPOSITORY_COMMIT_HASH ||
      (() => {
        try {
          return child
            .execSync("git rev-parse HEAD", { encoding: "utf8" })
            .trim();
        } catch (error) {
          console.warn(
            "[error]: could not get user repository commit hash:",
            error,
          );
          return "";
        }
      })();

    const AWESOME_WEBSITE_BUILD_TAG =
      env.AWESOME_WEBSITE_TAG !== "unknown"
        ? env.AWESOME_WEBSITE_TAG
        : (() => {
            try {
              return child
                .execSync("git describe --tags --exact-match", {
                  encoding: "utf8",
                })
                .trim();
            } catch {
              return "unknown";
            }
          })();

    // NOTE: try to extract workflow filename from github.workflow_ref or github.workflow
    // github.workflow_ref format: owner/repo/.github/workflows/filename.yml@refs/heads/branch
    // github.workflow can be either a name (e.g., "Build Awesome Website") or filename
    const GITHUB_WORKFLOW_FILE_NAME =
      env.GITHUB_WORKFLOW_REF.match(/\.github\/workflows\/([^@]+)/)?.[1] ?? "";

    const REPOSITORY_BUNDLED_FILES = env.REPOSITORY_BUNDLED_FILES
      ? env.REPOSITORY_BUNDLED_FILES.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const REPOSITORY_IGNORE = env.REPOSITORY_IGNORE
      ? env.REPOSITORY_IGNORE.split(",").map((s) => s.trim()).filter(Boolean)
      : [".git", "node_modules", ".DS_Store"];

    const PLUGINS_DIRECTORY_PATH = env.PLUGINS_DIRECTORY_PATH
      ? path.resolve(env.REPOSITORY_DIRECTORY_PATH, env.PLUGINS_DIRECTORY_PATH)
      : path.resolve(env.REPOSITORY_DIRECTORY_PATH, "plugins");

    return {
      ...env,
      BASE,
      GITHUB_REPOSITORY_OWNER,
      GITHUB_REPOSITORY_NAME,
      USER_REPOSITORY_COMMIT_HASH,
      AWESOME_WEBSITE_BUILD_TAG,
      GITHUB_WORKFLOW_FILE_NAME,
      REPOSITORY_BUNDLED_FILES,
      REPOSITORY_IGNORE,
      REPOSITORY_PUBLIC_SUBDIR: env.REPOSITORY_PUBLIC_SUBDIR,
      PLUGINS_DIRECTORY_PATH,
    };
  });

const Environment = EnvironmentSchema.parse(process.env);

const loaded = repository.load({
  path: Environment.REPOSITORY_DIRECTORY_PATH,
  files: [
    Environment.LIST_FILE_PATH,
    ...Environment.REPOSITORY_BUNDLED_FILES,
  ],
  ignore: Environment.REPOSITORY_IGNORE,
  publicSubdir: Environment.REPOSITORY_PUBLIC_SUBDIR,
  validators: {
    [Environment.LIST_FILE_PATH]: (raw: string): AwesomeList => AwesomeListSchema.parse(yaml.load(raw))
  },
});

const list = loaded.files[Environment.LIST_FILE_PATH] as unknown as AwesomeList;

export default vite.defineConfig({
  plugins: [
    viteReact(),
    plugins(Environment.PLUGINS_DIRECTORY_PATH),
    repository.plugin(loaded),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
      },
      manifest: {
        name: list.title,
        short_name: list.title,
        description: list.description,
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
  define: {
    __CONFIGURATION__: {
      repository: {
        url: Environment.GITHUB_REPOSITORY_URL,
        owner: Environment.GITHUB_REPOSITORY_OWNER,
        name: Environment.GITHUB_REPOSITORY_NAME,
        commit: Environment.USER_REPOSITORY_COMMIT_HASH,
        workflow: {
          name: Environment.GITHUB_WORKFLOW_FILE_NAME,
        },
      },
      build: {
        time: new Date().toISOString(),
        tag: Environment.AWESOME_WEBSITE_BUILD_TAG,
      },
      awesome: true,
      list: {
        path: Environment.LIST_FILE_PATH,
      },
      storage: {
        path: "storage",
      },
    } satisfies typeof __CONFIGURATION__,
  },
  optimizeDeps: {
    // Force Vite to discover and pre-bundle all deps used by the `shared`
    // alias (which lives outside the project root) during the initial scan.
    // Without this, Vite finds new imports mid-session, regenerates chunks
    // with a new browserHash, and the browser requests the old chunk names
    // which no longer exist — resulting in 404s and a blank page.
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "sonner",
      "zod/v4",
      "clsx",
      "tailwind-merge",
      "@radix-ui/themes",
      "@radix-ui/react-dialog",
      "@radix-ui/react-icons",
      "@radix-ui/react-toggle-group",
      "@raideno/auto-form/registry",
      "@raideno/auto-form/ui",
    ],
  },
  base: Environment.BASE,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      shared: path.resolve(__dirname, "../shared/src"),
    },
  },
});
