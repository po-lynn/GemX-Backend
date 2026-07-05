import { cacheTag, updateTag } from "next/cache";
import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import { getAllColors, getColorById } from "../color";
import type { ColorOption, ColorForEdit } from "../color";

function getColorGlobalTag() {
  return getGlobalTag("color");
}

function getColorIdTag(id: string) {
  return getIdTag("color", id);
}

export async function getCachedColors(): Promise<ColorOption[]> {
  "use cache";
  cacheTag(getColorGlobalTag());
  return getAllColors();
}

export async function getCachedColorById(
  id: string
): Promise<ColorForEdit | null> {
  "use cache";
  cacheTag(getColorGlobalTag(), getColorIdTag(id));
  return getColorById(id);
}

export function revalidateColorCache(id?: string) {
  updateTag(getColorGlobalTag());
  if (id) updateTag(getColorIdTag(id));
}
