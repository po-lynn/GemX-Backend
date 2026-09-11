"use client"

import type { SellingGuideContent } from "@/features/app-content/schemas/app-content"
import type { ContentLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"

type Props = {
  value: SellingGuideContent
  onChange: (value: SellingGuideContent) => void
  editLanguage: ContentLanguage
  onEditLanguageChange: (lang: ContentLanguage) => void
}

export function SellingGuideTab(props: Props) {
  return (
    <MultilangBlockNoteTab
      title="Selling Guide"
      editorName="sellingGuideContentEditor"
      {...props}
    />
  )
}
