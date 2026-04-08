import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata = {
  title: "Blog — SOTAVerified",
  description:
    "Updates, deep dives, and commentary on ML reproducibility, benchmark verification, and autonomous research agents.",
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Blog</h1>

      {posts.length === 0 ? (
        <p className="text-sm text-gray-500">No posts yet.</p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block"
              >
                <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>
                <time className="text-xs text-gray-400 mt-1 block">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {post.excerpt && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">
                    {post.excerpt}
                  </p>
                )}
                <span className="text-sm text-blue-600 mt-2 inline-block group-hover:underline">
                  Read more
                </span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
