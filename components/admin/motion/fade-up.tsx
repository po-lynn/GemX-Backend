"use client"
import { motion } from "motion/react"
import { springs, variants } from "@/lib/motion-spring"

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants.fadeUp}
      transition={{ ...springs.entrance, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
