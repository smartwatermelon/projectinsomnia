import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { slugFromId } from "../lib/slugFromId";

export async function GET(context) {
  const now = new Date();
  const posts = await getCollection(
    "blog",
    ({ data }) => !data.draft && data.date <= now,
  );

  posts.sort((a, b) => b.data.date - a.data.date);

  return rss({
    title: "Project Insomnia",
    description:
      "Andrew Rich — writing about software, Spokane, and whatever else.",
    site: context.site,
    items: posts.map((post) => {
      const slug = slugFromId(post.id);
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description ?? "",
        link: `/blog/${slug}/`,
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
