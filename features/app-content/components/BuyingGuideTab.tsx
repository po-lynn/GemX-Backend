"use client"

import type { BuyingGuideContent } from "@/features/app-content/schemas/app-content"
import type { ContentLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"

type Props = {
  value: BuyingGuideContent
  onChange: (value: BuyingGuideContent) => void
  editLanguage: ContentLanguage
  onEditLanguageChange: (lang: ContentLanguage) => void
}

export function BuyingGuideTab(props: Props) {
  return (
    <MultilangBlockNoteTab
      title="Buying Guide"
      editorName="buyingGuideContentEditor"
      {...props}
    />
  )
}
