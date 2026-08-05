'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Content that arrives as it enters the viewport.
 *
 * The motion here is doing one job: sequencing. On a page where the argument
 * builds (you buy, then it is confirmed, then it is delivered), letting items
 * land in order helps a reader follow the order. It is not decoration, and it
 * is not applied to everything.
 *
 * `once: true` because a section that re-animates every time you scroll past
 * stops being sequencing and starts being noise.
 *
 * Under `prefers-reduced-motion` the content is simply present. Not faded in
 * faster, not shortened - present.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      // Marked so the no-JavaScript fallback in layout.tsx can force these
      // visible. Without it, a reader whose JS never runs sees a page whose
      // sections are permanently at opacity 0.
      data-reveal
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
