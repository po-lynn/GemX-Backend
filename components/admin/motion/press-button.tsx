"use client"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"
import { springs } from "@/lib/motion-spring"

export function PressButton({
  children,
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={springs.press}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(props as object)}
    >
      {children}
    </motion.button>
  )
}
