'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

/**
 * A full-height hero the next section slides over.
 *
 * The hero is sticky at the top of the page. The content after it is opaque
 * and simply scrolls up over the top, which is what produces the sense that
 * the page is moving itself: the hero holds still, the destinations arrive.
 *
 * The hero also dims and drifts back as it is covered, driven by scroll
 * position rather than a timer, so it moves exactly as fast as the reader
 * does. That is the difference between guided and being animated at.
 *
 * Two things this deliberately is not:
 *
 *   It is not programmatic auto-scroll. Taking the scrollbar away breaks
 *   keyboard navigation and screen readers, and on a page with a checkout it
 *   reads as broken rather than expensive. The reader controls the input; the
 *   page only controls what that input looks like.
 *
 *   It is not built on negative margins and viewport-height arithmetic. An
 *   earlier version pulled the content up over the hero by exactly one
 *   viewport, and the two fought: the hero bled through the cards. Sticky
 *   plus an opaque following section needs no maths and cannot desynchronise.
 *
 * Under reduced motion the sticky behaviour is dropped and the sections simply
 * follow one another. A pinned section that transforms as you scroll is
 * precisely the vestibular trigger that setting exists for.
 */
export function PinnedHero({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: sentinel,
    offset: ['start start', 'end start'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95])

  if (reduce) {
    return (
      <>
        <section className="flex min-h-[100dvh] flex-col justify-center">{hero}</section>
        <div className="relative bg-background">{children}</div>
      </>
    )
  }

  return (
    /*
      This wrapper is load-bearing, not decoration.

      A sticky element sticks within its parent's box. Without this container
      the hero's parent is the page itself, so it stays pinned all the way
      down - and every translucent section further down the page has the hero
      showing through it. Bounding it here releases the hero the moment the
      destinations end.
    */
    <div className="relative">
      <div ref={sentinel} className="sticky top-0 h-[100dvh] overflow-hidden">
        <motion.div style={{ opacity, scale }} className="h-full">
          {hero}
        </motion.div>
      </div>

      {/*
        Opaque, and above the hero. The other half of the mechanism: without a
        background the sticky hero shows straight through the gaps between
        cards.
      */}
      <div className="relative z-10 bg-background">{children}</div>
    </div>
  )
}
