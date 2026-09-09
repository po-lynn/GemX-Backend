import { cacheTag, cacheLife, updateTag } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import {
  getPublishedAboutUs,
  getPublishedFollowUs,
  getPublishedHelpSupport,
} from "@/features/app-content/db/app-content"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
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

export function revalidateAppContentCache(): void {
  updateTag(getAppContentGlobalTag())
}
