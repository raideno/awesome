import yaml from "js-yaml";
import type { Plugin } from "vite";
import type { AwesomeList } from "shared/types/list";

/**
 * Generate a markdown representation of the awesome list
 */
const generateMarkdown = (list: AwesomeList): string => {
  let md = `# ${list.title}\n\n`;
  md += `${list.description}\n\n`;

  if (list.author) {
    md += `**Author:** ${list.author}\n\n`;
  }

  if (list.links && list.links.length > 0) {
    md += `## Links\n\n`;
    for (const link of list.links) {
      md += `- ${link}\n`;
    }
    md += `\n`;
  }

  if (list.elements && list.elements.length > 0) {
    md += `## Resources\n\n`;

    // Group elements by group if they have one
    const grouped = new Map<string, typeof list.elements>();
    const ungrouped: typeof list.elements = [];

    for (const element of list.elements) {
      if (element.group) {
        if (!grouped.has(element.group)) {
          grouped.set(element.group, []);
        }
        grouped.get(element.group)!.push(element);
      } else {
        ungrouped.push(element);
      }
    }

    // Render grouped elements
    for (const [groupName, elements] of grouped) {
      md += `### ${groupName}\n\n`;
      for (const element of elements) {
        md += `#### ${element.name}\n\n`;
        md += `${element.description}\n\n`;
        if (element.link) {
          md += `[View Resource](${element.link})\n\n`;
        }
        if (element.tags && element.tags.length > 0) {
          md += `**Tags:** ${element.tags.join(", ")}\n\n`;
        }
        if (element.notes) {
          md += `**Notes:** ${element.notes}\n\n`;
        }
      }
    }

    // Render ungrouped elements
    if (ungrouped.length > 0) {
      for (const element of ungrouped) {
        md += `### ${element.name}\n\n`;
        md += `${element.description}\n\n`;
        if (element.link) {
          md += `[View Resource](${element.link})\n\n`;
        }
        if (element.tags && element.tags.length > 0) {
          md += `**Tags:** ${element.tags.join(", ")}\n\n`;
        }
        if (element.notes) {
          md += `**Notes:** ${element.notes}\n\n`;
        }
      }
    }
  }

  if (list.readme) {
    md += `## README\n\n${list.readme}\n`;
  }

  return md;
};

/**
 * Vite plugin to serve the awesome list in different formats
 */
export default (awesomeList: AwesomeList): Plugin => {
  return {
    name: "list-formats",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";

        // Handle /list.yaml
        if (url === "/list.yaml" || url.startsWith("/list.yaml?")) {
          res.setHeader("Content-Type", "text/yaml; charset=utf-8");
          res.end(yaml.dump(awesomeList));
          return;
        }

        // Handle /list.json
        if (url === "/list.json" || url.startsWith("/list.json?")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(awesomeList, null, 2));
          return;
        }

        // Handle /list.md
        if (url === "/list.md" || url.startsWith("/list.md?")) {
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(generateMarkdown(awesomeList));
          return;
        }

        next();
      });
    },
    generateBundle() {
      // Generate static files for production build
      this.emitFile({
        type: "asset",
        fileName: "list.yaml",
        source: yaml.dump(awesomeList),
      });

      this.emitFile({
        type: "asset",
        fileName: "list.json",
        source: JSON.stringify(awesomeList, null, 2),
      });

      this.emitFile({
        type: "asset",
        fileName: "list.md",
        source: generateMarkdown(awesomeList),
      });
    },
  };
};
