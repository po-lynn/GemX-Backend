import { pgEnum } from "drizzle-orm/pg-core"
export const userRoles = ["user", "admin", "escrow"] as const
export type UserRole = (typeof userRoles)[number]
export const userRoleEnum = pgEnum("user_role", userRoles)
