/** Facebook's share-dialog URL for a given public link. */
export function buildFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/** Telegram's share-dialog URL for a given public link and pre-filled message text. */
export function buildTelegramShareUrl(url: string, title: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}
