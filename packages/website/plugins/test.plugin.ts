import type { PluginDefinition } from "shared/types/plugins";

export default {
  id: "test-plugin",
  name: "Test Plugin",
  description: "A plugin used for testing purposes",
  version: "1.0.0",
  extensions: [
    {
      type: "site.action-bar",
    },
  ]
} satisfies PluginDefinition;
