import { pgEnum } from "drizzle-orm/pg-core"
export const userRoles = ["user", "admin", "root", "seller", "mobile"] as const
export type UserRole = (typeof userRoles)[number]
export const userRoleEnum = pgEnum("user_role", userRoles)
