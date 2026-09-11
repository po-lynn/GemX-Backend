import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import {
  getPublishedAboutUs,
  getPublishedBuyingGuide,
  getPublishedFollowUs,
  getPublishedHelpSupport,
  getPublishedSellingGuide,
  getPublishedTermsConditions,
} from "@/features/app-content/db/app-content"
import type {
  AboutUsContent,
  BuyingGuideContent,
  FollowUsContent,
  HelpSupportContent,
  SellingGuideContent,
  TermsConditionsContent,
} from "@/features/app-content/schemas/app-content"

function getAppContentGlobalTag() {
  return getGlobalTag("appContent")
}

export async function getCachedPublishedAboutUs(): Promise<AboutUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedAboutUs()
}

export async function getCachedPublishedFollowUs(): Promise<FollowUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedFollowUs()
}

export async function getCachedPublishedHelpSupport(): Promise<HelpSupportContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedHelpSupport()
}

export async function getCachedPublishedTermsConditions(): Promise<TermsConditionsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedTermsConditions()
}

export async function getCachedPublishedBuyingGuide(): Promise<BuyingGuideContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedBuyingGuide()
}

export async function getCachedPublishedSellingGuide(): Promise<SellingGuideContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  return getPublishedSellingGuide()
}

export function revalidateAppContentCache(): void {
  updateTag(getAppContentGlobalTag())
}
