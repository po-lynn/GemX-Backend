export type CACHE_TAG =
  | "products"
  | "users"
  | "category"
  | "categories"
  | "laboratory"
  | "origin"
  | "color"
  | "ratingTag"
  | "precautionTag"
  | "appContent"
  | "profile"
  | "home"
  | "rankedProducts"
  | "rankedProductsUser"

export function getGlobalTag(tag: CACHE_TAG) {
  return `global:${tag}` as const
}

export function getIdTag(tag: CACHE_TAG, id: string) {
  return `id:${id}-${tag}` as const
}
