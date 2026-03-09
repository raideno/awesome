/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __CONFIGURATION__: {
  repository: {
    url: string;
    owner: string;
    name: string;
    commit: string;
    workflow: {
      name: string;
    };
  };
  build: {
    time: string;
    tag: string;
  };
  awesome: true;
  list: {
    path: string;
  };
  storage: {
    path: string;
  };
};



declare module "virtual:repository" {
  import type { RepositoryVirtualModule } from "@/contexts/repository";

  /**
   * Build-time repository snapshot.
   *
   * - `bundled`: files that were inlined at build time (relativePath → content).
   * - `baseUrl`: public base URL from which all repository files are served
   *              at runtime, e.g. "/repository".
   */
  const repository: RepositoryVirtualModule;
  export default repository;
}
