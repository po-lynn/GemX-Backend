import { cacheTag, updateTag } from "next/cache"
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

export function revalidateAppContentCache(): void {
  updateTag(getAppContentGlobalTag())
}
