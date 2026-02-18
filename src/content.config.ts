import { defineCollection, z } from "astro:content";

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  mediumUrl: z.string().url().optional(),
  draft: z.boolean().default(false),
});

export const collections = {
  blog: defineCollection({ type: "content", schema: postSchema }),
  ouatrevisit: defineCollection({ type: "content", schema: postSchema }),
  elections: defineCollection({ type: "content", schema: postSchema }),
};
