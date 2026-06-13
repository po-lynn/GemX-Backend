"use client"
import { motion } from "motion/react"
import { springs } from "@/lib/motion-spring"

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.page}
    >
      {children}
    </motion.div>
  )
}
