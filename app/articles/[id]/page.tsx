import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getArticleById } from "@/features/articles/db/articles";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ArticleDetailPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || article.status !== "published") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
        <article className="mt-6">
          <p className="text-sm text-muted-foreground">
            {article.author}
            {article.publishDate
              ? ` · ${new Date(article.publishDate).toLocaleDateString()}`
              : null}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Open this article in the GemX app for full rich content. Article ID: {article.id}
          </p>
        </article>
      </main>
      <HomeFooter />
    </div>
  );
}

