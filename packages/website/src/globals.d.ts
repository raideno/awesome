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
};

declare const __PLUGINS__: Array<any>;
