import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post Not Found — SOTAVerified" };

  return {
    title: `${post.title} — SOTAVerified`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/blog"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; Back to blog
      </Link>

      <article>
        <h1 className="text-2xl font-bold tracking-tight mb-2 text-gray-900 dark:text-gray-100">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-6">
          <time>
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.author && (
            <>
              <span>|</span>
              <span>{post.author}</span>
            </>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="prose prose-sm prose-gray dark:prose-invert max-w-none leading-relaxed blog-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ node: _node, ...props }) => (
                <div className="overflow-x-auto -mx-1 my-6">
                  <table {...props} />
                </div>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
