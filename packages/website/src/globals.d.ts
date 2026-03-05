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
    content: any;
    path: string;
  };
  storage: {
    path: string;
  };
};

declare module "virtual:plugin-storage" {
  /**
   * Build-time snapshot of the storage directory.
   * Shape: { [pluginId: string]: { [filename: string]: string } }
   */
  const storage: Record<string, Record<string, string>>;
  export default storage;
}
