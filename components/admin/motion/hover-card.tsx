"use client"
import { motion } from "motion/react"
import { springs } from "@/lib/motion-spring"

export function HoverCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      whileTap={{ scale: 0.98 }}
      transition={springs.hover}
      className={className}
    >
      {children}
    </motion.div>
  )
}
