import { cacheTag, updateTag } from "next/cache";
import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import {
  getAllLaboratories,
  getLaboratoryById,
} from "../laboratory";
import type { LaboratoryOption, LaboratoryForEdit } from "../laboratory";

export function getLaboratoryGlobalTag() {
  return getGlobalTag("laboratory");
}

export function getLaboratoryIdTag(id: string) {
  return getIdTag("laboratory", id);
}

export async function getCachedLaboratories(): Promise<LaboratoryOption[]> {
  "use cache";
  cacheTag(getLaboratoryGlobalTag());
  return getAllLaboratories();
}

export async function getCachedLaboratoryById(
  id: string
): Promise<LaboratoryForEdit | null> {
  "use cache";
  cacheTag(getLaboratoryGlobalTag(), getLaboratoryIdTag(id));
  return getLaboratoryById(id);
}

export function revalidateLaboratoryCache(id?: string) {
  updateTag(getLaboratoryGlobalTag());
  if (id) {
    updateTag(getLaboratoryIdTag(id));
  }
}
