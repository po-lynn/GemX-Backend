import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAllSpecies,
  getSpeciesById,
} from "../species"
import type { SpeciesOption, SpeciesForEdit } from "../species"

export function getSpeciesGlobalTag() {
  return getGlobalTag("species")
}

export function getSpeciesIdTag(id: string) {
  return getIdTag("species", id)
}

export async function getCachedSpecies(): Promise<SpeciesOption[]> {
  "use cache"
  cacheTag(getSpeciesGlobalTag())
  return getAllSpecies()
}

export async function getCachedSpeciesById(id: string): Promise<SpeciesForEdit | null> {
  "use cache"
  cacheTag(getSpeciesGlobalTag(), getSpeciesIdTag(id))
  return getSpeciesById(id)
}

export function revalidateSpeciesCache(id?: string) {
  updateTag(getSpeciesGlobalTag())
  if (id) {
    updateTag(getSpeciesIdTag(id))
  }
}
