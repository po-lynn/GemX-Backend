export const springs = {
  entrance: { type: "spring" as const, stiffness: 200, damping: 20, mass: 1 },
  hover:    { type: "spring" as const, stiffness: 300, damping: 25 },
  press:    { type: "spring" as const, stiffness: 400, damping: 30 },
  page:     { type: "spring" as const, stiffness: 180, damping: 22 },
}

export const variants = {
  fadeUp: {
    hidden:  { opacity: 0, y: 14, scale: 0.97 },
    visible: { opacity: 1, y: 0,  scale: 1 },
  },
  stagger: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.07 } },
  },
}
