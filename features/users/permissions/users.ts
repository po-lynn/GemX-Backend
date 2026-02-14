export const userPermissions = {
  admin: { list: true, create: true, edit: true, delete: true },
} as const;

export function canAdminManageUsers(role: string) {
  return role === "admin";
}
