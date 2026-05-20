import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getNewsById } from "@/features/news/db/news";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function NewsDetailPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const item = await getNewsById(id);

  if (!item || item.status !== "published") {
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
            {item.publish ? new Date(item.publish).toLocaleDateString() : null}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{item.title}</h1>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Open this news item in the GemX app for full rich content. News ID: {item.id}
          </p>
        </article>
      </main>
      <HomeFooter />
    </div>
  );
}
