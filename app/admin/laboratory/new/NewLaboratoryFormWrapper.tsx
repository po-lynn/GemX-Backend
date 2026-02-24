"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LaboratoryForm } from "@/features/laboratory/components";

/** Wrapper so the form gets a new key each time we navigate to the new page (fixes stale defaultValues). */
export function NewLaboratoryFormWrapper() {
  const pathname = usePathname();
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (pathname === "/admin/laboratory/new") {
      setFormKey((k) => k + 1);
    }
  }, [pathname]);

  return <LaboratoryForm key={formKey} mode="create" />;
}
