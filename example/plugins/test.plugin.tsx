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
      toggleble: false,
      onClick: (context) => {
        context.toast.info("Test site action bar button clicked");
      },
    },
    {
      type: "card.context-action",
      name: "Test Card Action (Public)",
      onClick: () => {
        console.log("Test card context action (public) clicked");
      },
    },
    {
      type: "card.context-action",
      name: "Test Card Action (Admin)",
      admin: true,
      onClick: () => {
        console.log("Test card context action (admin) clicked");
      },
    },
    {
      type: "group.context-action",
      name: "Test Group Action (Public)",
      onClick: () => {
        console.log("Test group context action (public) clicked");
      },
    },
    {
      type: "group.context-action",
      name: "Test Group Action (Admin)",
      admin: true,
      onClick: () => {
        console.log("Test group context action (admin) clicked");
      },
    },
  ]
} satisfies PluginDefinition;
