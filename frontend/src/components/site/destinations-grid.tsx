'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { Plan } from '@/lib/plans'
import { DestinationCard } from '@/components/ui/destination-card'
import { spring } from '@/lib/motion'

/**
 * Eight destinations, four to a row, arriving as the hero leaves.
 *
 * The stagger is 45ms per card. Long enough that the eye reads it as a
 * sequence, short enough that the last card is in place before anyone is
 * waiting for it. Beyond about 80ms a grid this size starts to feel slow
 * rather than choreographed.
 *
 * Staggering by row rather than by index, so cards land as two clean sweeps
 * instead of one long diagonal crawl across eight items.
 */
export function DestinationsGrid({
  plans,
  availability,
}: {
  plans: Plan[]
  availability: Record<string, number>
}) {
  const reduce = useReducedMotion()

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan, index) => (
        <motion.li
          key={plan.id}
          className="h-full"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ ...spring, delay: (index % 4) * 0.045 }}
        >
          <DestinationCard plan={plan} available={availability[plan.id]} />
        </motion.li>
      ))}
    </ul>
  )
}
