export function canAdminManageNews(role: string) {
  return role === "admin" || role === "internal";
}
