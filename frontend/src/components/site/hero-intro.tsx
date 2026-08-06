'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { spring } from '@/lib/motion'

/**
 * The hero's arrival.
 *
 * One movement, on load, establishing hierarchy: the eyebrow, headline,
 * subtext and buttons settle in the order you read them. That is the entire
 * justification. It does not loop, it does not parallax, and it does not
 * follow the cursor.
 *
 * `initial={false}` under reduced motion means the content is simply there on
 * the first frame, with no transition to sit through.
 */
export function HeroIntro({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      data-reveal
      initial={reduce ? false : 'hidden'}
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
    >
      {/* Each direct child inherits the stagger. */}
      {Array.isArray(children)
        ? children.map((child, index) => (
            <motion.div key={index} data-reveal variants={itemVariants}>
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  )
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: spring },
}
