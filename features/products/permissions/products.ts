export function canAdminManageProducts(role: string) {
  return role === "admin" || role === "supervisor"
}

export function canAdminManageCategories(role: string) {
  return role === "admin"
}
