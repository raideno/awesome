import { z } from 'zod/v4';
import { toast } from "sonner";
import type { AwesomeListElement } from "./list";

// TODO: correct the import
import type { ListContextType } from "../../../website/src/contexts/list"

// TODO: properly setup function types with the right context and inputs.

/**
 * A getter/setter pair that a plugin defines to back its reactive state.
 * The plugin is free to store values however it wants — in-memory, localStorage,
 * sessionStorage, IndexedDB, etc. The framework only calls these two functions
 * to read and write; it is the plugin's responsibility to make `set` trigger
 * whatever side-effects it needs.
 */
export interface PluginStateAdapter<T = unknown> {
  get: () => T;
  set: (value: T) => void;
}

/**
 * The object a plugin receives when the framework calls its `createContext`.
 * At this point the plugin can set up its state adapters and return them
 * so the framework can wire them into React.
 *
 * `register` must be called once per state key the plugin wants to expose.
 * The returned `use` hook can then be passed to React components.
 */
export interface PluginContextSetup {
  /**
   * Registers a state adapter under `key` and returns a React hook that
   * components can call to get the current value and a setter that triggers
   * a re-render.
   *
   * @param key     A stable identifier for this piece of state.
   * @param adapter The plugin-supplied get/set pair.
   * @returns       A React hook: `() => [value, setter]`
   */
  register: <T>(key: string, adapter: PluginStateAdapter<T>) => () => [T, (value: T) => void];
}

export interface PluginContext {
  /**
   * A sonner toast component.
   */
  toast: typeof toast;
  /**
   *
   */
  list: ListContextType;
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
  /**
   * Called once by the framework during plugin initialisation, before any
   * extension is rendered. Use it to register state adapters via
   * `setup.register(key, adapter)`.
   *
   * The function receives the base `PluginContext` (toast, list, storage, …)
   * so adapters can use storage or any other facility to back their state.
   *
   * Omit this field entirely if the plugin has no reactive state needs.
   */
  context: z.object({
    setup: z.function({
      input: [z.custom<PluginContext>(), z.custom<PluginContextSetup>()],
      output: z.void(),
    }).optional(),
  }).optional(),
  extensions: z.array(PluginExtensionSchema),
})

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>
