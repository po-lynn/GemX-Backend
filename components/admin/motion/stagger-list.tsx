"use client"
import React from "react"
import { motion } from "motion/react"
import { variants } from "@/lib/motion-spring"

export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants.stagger}
      className={className}
    >
      {React.Children.map(children, (child, i) => (
        <motion.div key={i} variants={variants.fadeUp}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
