import { createAuthClient } from "better-auth/react"
import { ac, admin, user } from "@/permissions/userRole"

import {
  adminClient,
  organizationClient
} from "better-auth/client/plugins"
export const authClient = createAuthClient({
  plugins: [
    
    adminClient({
      ac,
      roles: {
        admin,
        user,
      },
    }),
    organizationClient(),
  
  ],
})