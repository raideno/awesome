import child from "node:child_process";
import path from "node:path";

import * as z from "zod/v4";
import * as vite from "vite";

import viteReact from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import listFormatsPlugin from "./plugins/list-formats";
import metadataAwesomeList from "./plugins/metadata-awesome-list";
import yamlAwesomeListPlugin, {
  loadAwesomeList,
} from "./plugins/yaml-awesome-list";
import awesomePluginsPlugin, { loadPlugins } from "./plugins/awesome-plugins";

const EnvironmentSchema = z
  .looseObject({
    BASE_PATH: z.string().nonempty(),
    LIST_FILE_PATH: z.string().nonempty(),
    PLUGINS_DIRECTORY_PATH: z.string().optional(),
    GITHUB_REPOSITORY_URL: z.string().nonempty(),
    USER_REPOSITORY_COMMIT_HASH: z.string().optional().default(""),
    AWESOME_WEBSITE_TAG: z.string().optional().default("unknown"),
    GITHUB_WORKFLOW_REF: z.string().nonempty(),
  })
  .transform((env) => {
    const [GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_NAME] =
      env.GITHUB_REPOSITORY_URL.split("/").slice(-2);

    const BASE_PATH = env.BASE_PATH || `/${GITHUB_REPOSITORY_NAME}`;

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

    return {
      ...env,
      BASE_PATH,
      GITHUB_REPOSITORY_OWNER,
      GITHUB_REPOSITORY_NAME,
      USER_REPOSITORY_COMMIT_HASH,
      AWESOME_WEBSITE_BUILD_TAG,
      GITHUB_WORKFLOW_FILE_NAME,
    };
  });

const Environment = EnvironmentSchema.parse(process.env);

const AWESOME_LIST = loadAwesomeList(Environment.LIST_FILE_PATH);
const PLUGINS = await loadPlugins(Environment.PLUGINS_DIRECTORY_PATH);

export default vite.defineConfig({
  plugins: [
    viteReact(),
    yamlAwesomeListPlugin(Environment.LIST_FILE_PATH),
    awesomePluginsPlugin(Environment.PLUGINS_DIRECTORY_PATH),
    metadataAwesomeList(AWESOME_LIST, Environment.GITHUB_REPOSITORY_URL),
    listFormatsPlugin(AWESOME_LIST),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
      },
      manifest: {
        name: AWESOME_LIST.title,
        short_name: AWESOME_LIST.title,
        description: AWESOME_LIST.description,
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
    __PLUGINS__: PLUGINS satisfies typeof __PLUGINS__,
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
        content: AWESOME_LIST,
        path: Environment.LIST_FILE_PATH,
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
  base: Environment.BASE_PATH,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      shared: path.resolve(__dirname, "../shared/src"),
    },
  },
});
