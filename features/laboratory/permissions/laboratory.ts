export const laboratoryPermissions = {
  admin: {
    list: true,
    create: true,
    edit: true,
    delete: true,
  },
} as const;

export function canAdminManageLaboratory(role: string) {
  return role === "admin";
}
