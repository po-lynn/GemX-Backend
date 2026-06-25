export function canAdminManageProducts(role: string) {
  return role === "admin" || role === "internal"
}

export function canVerifyProducts(role: string) {
  return role === "admin" || role === "internal"
}

export function canAdminManageCategories(role: string) {
  return role === "admin"
}
