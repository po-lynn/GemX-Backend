export const productPermissions = {
  admin: {
    list: true,
    view: true,
    approve: true,
    reject: true,
    hide: true,
    edit: true,
    setFeatured: true,
  },
} as const

export function canAdminManageProducts(role: string) {
  return role === "admin"
}
