import { z } from 'zod/v4';
import { toast } from "sonner";

// TODO: properly setup function types with the right context and inputs.

export interface PluginContext {
  /**
   * A sonner toast component.
   */
  toast: typeof toast;
  /**
   * The plugin's metadata.
   */
  plugin: PluginMetadata;
  storage: {
    /**
     * Reads the content of a file in the plugin's storage.
     * By default the read will occur on the staged changes.
     *
     * @param name The filename to be read.
     * @returns The file content.
     */
    read: (name: string) => Promise<string>;
    /**
     *
     * @param name The filename to be written. If the file already exists, it will be overwritten.
     * @param content The content to be written to the file.
     * @returns Resolves when the write operation is complete.
     */
    write: (name: string, content: string) => Promise<void>;
    /**
     *
     * @returns A list of filenames available in the plugin's storage area.
     */
    list: () => Promise<Array<string>>;
  }
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
    type: z.literal('card.modal-content')
  }),
  z.object({
    type: z.literal('card.edit-sidebar')
  })
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
  extensions: z.array(PluginExtensionSchema)
})

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>
