import { cacheTag, cacheLife, updateTag } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import {
  getPublishedAboutUs,
  getPublishedBuyingGuide,
  getPublishedFollowUs,
  getPublishedHelpSupport,
  getPublishedPrivacyPolicy,
  getPublishedSellingGuide,
  getPublishedTermsConditions,
} from "@/features/app-content/db/app-content"
import type {
  AboutUsContent,
  BuyingGuideContent,
  FollowUsContent,
  HelpSupportContent,
  PrivacyPolicyContent,
  SellingGuideContent,
  TermsConditionsContent,
} from "@/features/app-content/schemas/app-content"

function getAppContentGlobalTag() {
  return getGlobalTag("appContent")
}

export async function getCachedPublishedAboutUs(): Promise<AboutUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  // Admin-managed reference data, only changes via revalidateAppContentCache.
  cacheLife("max")
  return getPublishedAboutUs()
}

export async function getCachedPublishedFollowUs(): Promise<FollowUsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedFollowUs()
}

export async function getCachedPublishedHelpSupport(): Promise<HelpSupportContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedHelpSupport()
}

export async function getCachedPublishedTermsConditions(): Promise<TermsConditionsContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedTermsConditions()
}

export async function getCachedPublishedBuyingGuide(): Promise<BuyingGuideContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedBuyingGuide()
}

export async function getCachedPublishedSellingGuide(): Promise<SellingGuideContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedSellingGuide()
}

export async function getCachedPublishedPrivacyPolicy(): Promise<PrivacyPolicyContent> {
  "use cache"
  cacheTag(getAppContentGlobalTag())
  cacheLife("max")
  return getPublishedPrivacyPolicy()
}

export function revalidateAppContentCache(): void {
  updateTag(getAppContentGlobalTag())
}
