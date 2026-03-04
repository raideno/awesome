import type { PluginDefinition } from "shared/types/plugins";

export default {
  id: "test-plugin",
  name: "Test Plugin",
  description: "A plugin used for testing purposes",
  version: "1.0.0",
  extensions: [
    {
      type: "site.action-bar",
      icon: () => <span>🧪</span>,
      tooltip: "Test Action",
      admin: true,
      toggleble: true,
      onToggle: (toggled: boolean) => {
        console.log(`Test Action toggled: ${toggled}`);
      },
    },
  ]
} satisfies PluginDefinition;
