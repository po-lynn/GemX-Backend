import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserById } from "@/features/users/db/users"
import PortalProfileForm from "@/components/portal/PortalProfileForm"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function PortalProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return notFound()

  const user = await getUserById(session.user.id)
  if (!user) return notFound()

  return <PortalProfileForm user={user} />
}
