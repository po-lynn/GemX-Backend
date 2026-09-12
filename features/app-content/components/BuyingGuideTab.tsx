"use client"

import type { BuyingGuideContent } from "@/features/app-content/schemas/app-content"
import type { NewsLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"

type Props = {
  value: BuyingGuideContent
  onChange: (value: BuyingGuideContent) => void
  editLanguage: NewsLanguage
  onEditLanguageChange: (lang: NewsLanguage) => void
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
