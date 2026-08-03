"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

export function ImageViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const closeRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(images.length - 1, i + 1)), [images.length])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = stripRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, prev, next])

  return (
    <div
      className="pd-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button ref={closeRef} className="pd-viewer-close" onClick={onClose} aria-label="Close viewer">
        <X size={18} />
      </button>
      <span className="pd-viewer-counter">{idx + 1} / {images.length}</span>

      <div className="pd-viewer-stage">
        <button
          className="pd-viewer-nav prev"
          onClick={prev}
          disabled={idx === 0}
          aria-label="Previous image"
        >
          <ChevronLeft size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[idx]}
          className="pd-viewer-img"
          src={images[idx]}
          alt={`Image ${idx + 1} of ${images.length}`}
        />
        <button
          className="pd-viewer-nav next"
          onClick={next}
          disabled={idx === images.length - 1}
          aria-label="Next image"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div ref={stripRef} className="pd-viewer-strip" role="list" aria-label="All images">
        {images.map((url, i) => (
          <button
            key={url}
            role="listitem"
            className={`pd-viewer-strip-thumb${i === idx ? " active" : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={i === idx ? "true" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />
          </button>
        ))}
      </div>
    </div>
  )
}
