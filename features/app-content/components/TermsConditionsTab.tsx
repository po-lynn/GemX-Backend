"use client"

import type { TermsConditionsContent } from "@/features/app-content/schemas/app-content"
import type { ContentLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"

type Props = {
  value: TermsConditionsContent
  onChange: (value: TermsConditionsContent) => void
  editLanguage: ContentLanguage
  onEditLanguageChange: (lang: ContentLanguage) => void
}

export function TermsConditionsTab(props: Props) {
  return (
    <MultilangBlockNoteTab
      title="Terms & Conditions"
      editorName="termsContentEditor"
      {...props}
    />
  )
}
