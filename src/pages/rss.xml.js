import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  posts.sort((a, b) => b.data.date - a.data.date);

  return rss({
    title: 'Project Insomnia',
    description: 'Andrew Rich — writing about software, Spokane, and whatever else.',
    site: context.site,
    items: posts.map((post) => {
      const slug = post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.mdx?$/, '');
      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description ?? '',
        link: `/blog/${slug}/`,
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
