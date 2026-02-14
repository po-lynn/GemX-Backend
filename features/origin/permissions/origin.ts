export const originPermissions = {
  admin: { list: true, create: true, edit: true, delete: true },
} as const;

export function canAdminManageOrigin(role: string) {
  return role === "admin";
}
