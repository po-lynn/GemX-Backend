export function canAdminManageNews(role: string) {
  return role === "admin";
}
