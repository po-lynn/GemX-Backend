import { cacheTag, updateTag } from "next/cache";
import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import { getAllOrigins, getOriginById } from "../origin";
import type { OriginOption, OriginForEdit } from "../origin";

export function getOriginGlobalTag() {
  return getGlobalTag("origin");
}

export function getOriginIdTag(id: string) {
  return getIdTag("origin", id);
}

export async function getCachedOrigins(): Promise<OriginOption[]> {
  "use cache";
  cacheTag(getOriginGlobalTag());
  return getAllOrigins();
}

export async function getCachedOriginById(
  id: string
): Promise<OriginForEdit | null> {
  "use cache";
  cacheTag(getOriginGlobalTag(), getOriginIdTag(id));
  return getOriginById(id);
}

export function revalidateOriginCache(id?: string) {
  updateTag(getOriginGlobalTag());
  if (id) updateTag(getOriginIdTag(id));
}
