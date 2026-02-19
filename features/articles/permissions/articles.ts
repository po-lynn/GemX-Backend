export function canAdminManageArticles(role: string) {
  return role === "admin";
}
