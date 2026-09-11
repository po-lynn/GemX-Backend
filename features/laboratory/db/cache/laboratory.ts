import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import {
  getAllLaboratories,
  getLaboratoryById,
} from "../laboratory";
import type { LaboratoryOption, LaboratoryForEdit } from "../laboratory";

function getLaboratoryGlobalTag() {
  return getGlobalTag("laboratory");
}

function getLaboratoryIdTag(id: string) {
  return getIdTag("laboratory", id);
}

export async function getCachedLaboratories(): Promise<LaboratoryOption[]> {
  "use cache";
  cacheTag(getLaboratoryGlobalTag());
  // Admin-managed reference data, only changes via revalidateLaboratoryCache.
  cacheLife("max");
  return getAllLaboratories();
}

export async function getCachedLaboratoryById(
  id: string
): Promise<LaboratoryForEdit | null> {
  "use cache";
  cacheTag(getLaboratoryGlobalTag(), getLaboratoryIdTag(id));
  cacheLife("max");
  return getLaboratoryById(id);
}

export function revalidateLaboratoryCache(id?: string) {
  updateTag(getLaboratoryGlobalTag());
  if (id) {
    updateTag(getLaboratoryIdTag(id));
  }
}
