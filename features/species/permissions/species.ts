export const speciesPermissions = {
  admin: {
    list: true,
    create: true,
    edit: true,
    delete: true,
  },
} as const

export function canAdminManageSpecies(role: string) {
  return role === "admin"
}
