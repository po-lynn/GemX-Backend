"use client";

import { Facebook, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { buildFacebookShareUrl, buildTelegramShareUrl } from "@/lib/share-links";

type ShareButtonsProps = {
  url: string;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function ShareButtons({ url, title, disabled = false, disabledReason }: ShareButtonsProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <div className="n-share-row" title={disabled ? disabledReason : undefined}>
      <a
        href={disabled ? undefined : buildFacebookShareUrl(url)}
        role={disabled ? "link" : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Facebook size={15} />
        Facebook
      </a>
      <a
        href={disabled ? undefined : buildTelegramShareUrl(url, title)}
        role={disabled ? "link" : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Send size={15} />
        Telegram
      </a>
      <button
        type="button"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        disabled={disabled}
        onClick={handleCopy}
      >
        <Copy size={15} />
        Copy link
      </button>
    </div>
  );
}
