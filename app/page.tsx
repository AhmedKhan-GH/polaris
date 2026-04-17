import { db } from "@/lib/db";
import { posts } from "@/lib/schema";

export default async function Home() {
  const allPosts = await db.select().from(posts);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-8 py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Posts
        </h1>
        <ul className="flex flex-col gap-4">
          {allPosts.map((post) => (
            <li
              key={post.id}
              className="rounded-lg border border-black/[.08] p-6 dark:border-white/[.145]"
            >
              <h2 className="text-lg font-medium text-black dark:text-zinc-50">
                {post.title}
              </h2>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {post.content}
              </p>
              <time className="mt-3 block text-sm text-zinc-400 dark:text-zinc-500">
                {post.createdAt}
              </time>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
