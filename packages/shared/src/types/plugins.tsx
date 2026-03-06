import { z } from 'zod/v4';
import { toast } from "sonner";
import type { AwesomeListElement } from "./list";

// TODO: correct the import, not good to do this from a completely separate package.
import type { ListContextType } from "../../../website/src/contexts/list"
import type { RepositoryContextType } from "../../../website/src/contexts/repository"


export interface PluginContext {
  /**
   * A sonner toast component.
   */
  toast: typeof toast;
  /**
   * The list context — a higher-level helper for reading and updating the
   * awesome list (list.yaml). Plugins that only need raw file access should
   * use `repository` directly.
   */
  list: ListContextType;
  /**
   * The plugin's metadata.
   */
  plugin: PluginMetadata;
  /**
   * The full repository context. Plugins can read, write, and track changes
   * to any file in the repository using this object.
   *
   * @example
   * // Read a file
   * const content = await context.repository.get("storage/my-plugin/data.json");
   *
   * // Write a file
   * context.repository.write("storage/my-plugin/data.json", JSON.stringify(data));
   */
  repository: RepositoryContextType;
}

export const PluginExtensionSchema = z.union([
  z.union([
    z.object({
      type: z.literal('site.action-bar'),
      tooltip: z.string().optional(),
      admin: z.boolean().optional(),
      toggleble: z.literal(true),
      icon: z.custom<React.FC>(),
      onToggle: z.function({
        input: [z.custom<PluginContext>(), z.boolean()],
      })
    }),
    z.object({
      type: z.literal('site.action-bar'),
      admin: z.boolean().optional(),
      toggleble: z.literal(false),
      icon: z.custom<React.FC>(),
      tooltip: z.string().optional(),
      onClick: z.function({
        input: [z.custom<PluginContext>()],
      })
    }),
  ]),
  z.object({
    type: z.literal('site.header-action'),
    admin: z.boolean().optional(),
    render: z.custom<React.FC<{ context: PluginContext }>>(),
  }),
  z.object({
    type: z.literal('card.context-action'),
    name: z.string(),
    admin: z.boolean().optional(),
    onClick: z.function({
      input: [z.custom<PluginContext>()],
    })
  }),
  z.object({
    type: z.literal('group.context-action'),
    name: z.string(),
    admin: z.boolean().optional(),
    onClick: z.function({
      input: [z.custom<PluginContext>()],
    })
  }),
  z.object({
    type: z.literal('card.modal-content'),
    render: z.custom<React.FC<{ element: AwesomeListElement; context: PluginContext }>>(),
  }),
]);

export type PluginExtension = z.infer<typeof PluginExtensionSchema>;

export const PluginMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
})

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>

export const PluginDefinitionSchema = PluginMetadataSchema.extend({
  context: z.object({
    setup: z.function({
      input: [z.custom<PluginContext>()],
      output: z.void(),
    }).optional(),
  }).optional(),
  extensions: z.array(PluginExtensionSchema),
})

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>
