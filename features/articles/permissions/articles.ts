export function canAdminManageArticles(role: string) {
  return role === "admin" || role === "supervisor";
}
