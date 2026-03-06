import { z } from "zod/v4";

export const MAX_TAGS = 16;

export const AwesomeListElementSchema = z.looseObject({
  id: z.string().regex(/^\d+$/).max(8),
  name: z.string().max(128),
  description: z.string().max(192),
  link: z.url().optional(),
  tags: z.array(z.string()).max(MAX_TAGS),
  group: z.string().max(64).optional(),
});
export type AwesomeListElement = z.infer<typeof AwesomeListElementSchema>;

const AwesomeListBaseSchema = z.looseObject({
  title: z.string().max(128),
  description: z.string().max(192),
  author: z.string().max(64),
  thumbnail: z.string().optional(),
  elements: z.array(AwesomeListElementSchema),
  links: z.array(z.url()).max(4).optional(),
});

export const AwesomeListSchema = AwesomeListBaseSchema.refine(
  (data) => {
    const ids = data.elements.map((el) => el.id);
    return new Set(ids).size === ids.length;
  },
  {
    message: "Each element must have a unique id",
    path: ["elements"],
  },
);
export type AwesomeList = z.infer<typeof AwesomeListSchema>;

export const AwesomeListMetadata = AwesomeListBaseSchema.omit({
  elements: true,
});

export type AwesomeListWithoutLinks = z.infer<typeof AwesomeListMetadata>;
