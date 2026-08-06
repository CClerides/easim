'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { spring } from '@/lib/motion'

/**
 * Content that arrives as it enters the viewport.
 *
 * The motion is doing one job: sequencing. On a page where the argument builds
 * (you buy, then it is confirmed, then it is delivered), letting items land in
 * order helps a reader follow that order. It is not decoration and it is not
 * applied to everything.
 *
 * `once: true` because a section that re-animates every time you scroll past
 * stops being sequencing and becomes noise.
 *
 * The transition is a critically damped spring rather than a timed curve, so
 * an element caught mid-arrival by a fast scroll settles from wherever it
 * actually is instead of snapping back to a scripted keyframe.
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
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  )
}
