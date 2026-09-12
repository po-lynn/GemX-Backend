"use client"

import type { TermsConditionsContent } from "@/features/app-content/schemas/app-content"
import type { NewsLanguage } from "@/features/content/services/google-translate"
import { MultilangBlockNoteTab } from "@/features/app-content/components/MultilangBlockNoteTab"

type Props = {
  value: TermsConditionsContent
  onChange: (value: TermsConditionsContent) => void
  editLanguage: NewsLanguage
  onEditLanguageChange: (lang: NewsLanguage) => void
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
