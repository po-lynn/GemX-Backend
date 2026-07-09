import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getArticleById } from "@/features/articles/db/articles";
import { extractExcerpt } from "@/lib/extract-excerpt";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || article.status !== "published") {
    return {};
  }

  const description = extractExcerpt(article.content) || undefined;
  const images = article.coverImage ? [article.coverImage] : undefined;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images,
    },
  };
}

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
