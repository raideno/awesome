import { z } from 'zod/v4';

// TODO: properly setup function types with the right context and inputs.

export const PluginDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  extensions: z.array(
    z.union([
      z.union([
        z.object({
          type: z.literal('site.action-bar'),
          tooltip: z.string().optional(),
          admin: z.boolean().optional(),
          toggleble: z.literal(true),
          icon: z.custom<React.FC>(),
          onToggle: z.function({
            input: [z.boolean()],
          })
        }),
        z.object({
          type: z.literal('site.action-bar'),
          admin: z.boolean().optional(),
          toggleble: z.literal(false),
          icon: z.custom<React.FC>(),
          tooltip: z.string().optional(),
          onClick: z.function()
        }),
      ]),
      z.object({
        type: z.literal('card.context-action'),
        name: z.string(),
        admin: z.boolean().optional(),
        onClick: z.function()
      }),
      z.object({
        type: z.literal('group.context-action'),
        name: z.string(),
        admin: z.boolean().optional(),
        onClick: z.function()
      }),
      z.object({
        type: z.literal('card.modal-content')
      }),
      z.object({
        type: z.literal('card.edit-sidebar')
      })
    ])
  )
})

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>
