export function canAdminManageUsers(role: string) {
  return role === "admin" || role === "internal";
}
