"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

type Props = {
  role: string
  permissions: Record<string, boolean>
}

export function AdminSidebarSheet({ role, permissions }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-80">
        <AdminSidebar role={role} permissions={permissions} className="w-full border-r-0" />
      </SheetContent>
    </Sheet>
  )
}
