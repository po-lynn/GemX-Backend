export const categoryPermissions = {
  admin: {
    list: true,
    create: true,
    edit: true,
    delete: true,
  },
} as const

export function canAdminManageCategories(role: string) {
  return role === "admin"
}
