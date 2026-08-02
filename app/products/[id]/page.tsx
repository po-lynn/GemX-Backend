import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { formatPriceWithCurrency, maskPrice } from "@/lib/formatters"
import {
  IOS_APP_STORE_URL,
  ANDROID_PLAY_STORE_URL,
  productDeepLinkUrl,
} from "@/lib/deep-link"
import { OpenInAppRedirect } from "./OpenInAppRedirect"

type Props = {
  params: Promise<{ id: string }>
}

/**
 * A collector piece's full listing is gated behind an approved show-request
 * (see GET /api/products/[id]); this public, unauthenticated page can never
 * hold that approval, so it always renders the restricted view for those —
 * masked price, no description, no seller contact details.
 */
function displayPrice(product: { price: string; currency: "USD" | "MMK"; isCollectorPiece: boolean }) {
  return product.isCollectorPiece
    ? maskPrice(product.price)
    : formatPriceWithCurrency(Number(product.price), product.currency)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection()
  const { id } = await params
  const product = await getCachedProduct(id)

  if (!product || product.status === "draft") return {}

  const description = product.isCollectorPiece ? undefined : product.description ?? undefined
  const images = product.imageUrls[0] ? [product.imageUrls[0]] : undefined

  return {
    title: product.title,
    description,
    openGraph: { title: product.title, description, images },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images,
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  await connection()
  const { id } = await params
  const product = await getCachedProduct(id)

  if (!product || product.status === "draft") {
    notFound()
  }

  const showDescription = !product.isCollectorPiece && product.description
  const coverImage = product.imageUrls[0]

  return (
    <div className="min-h-screen bg-background">
      <OpenInAppRedirect productId={product.id} />
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>

        <article className="mt-6">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt={product.title}
              className="w-full rounded-xl object-cover"
            />
          ) : null}

          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">
            {product.title}
          </h1>
          <p className="mt-2 text-xl font-medium">{displayPrice(product)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Sold by {product.sellerName}</p>

          {showDescription ? (
            <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={productDeepLinkUrl(product.id)}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Open in GemX app
            </a>
            <a
              href={IOS_APP_STORE_URL}
              className="rounded-full border px-5 py-2.5 text-sm font-semibold"
            >
              Download on the App Store
            </a>
            <a
              href={ANDROID_PLAY_STORE_URL}
              className="rounded-full border px-5 py-2.5 text-sm font-semibold"
            >
              Get it on Google Play
            </a>
          </div>
        </article>
      </main>
      <HomeFooter />
    </div>
  )
}
