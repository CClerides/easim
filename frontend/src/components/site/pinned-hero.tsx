'use client'

import type { ReactNode } from 'react'

/**
 * The hero, holding a full viewport.
 *
 * This used to pin with `position: sticky` while the next section scrolled
 * over it. That had to go, and the reason is worth recording because it is not
 * obvious:
 *
 * A sticky element carries its scroll-snap area with it as it sticks. With
 * section snapping switched on, the hero's snap point followed the viewport
 * down and kept pulling the scroll position back to itself. The result was a
 * page stuck at 64px of a possible 2790 with the footer unreachable. Measured,
 * not guessed.
 *
 * Pinning and snapping are two answers to the same question - how does the
 * page feel guided - and only one of them can win. Snapping is the one that
 * was asked for, so the hero is now an ordinary full-height section and the
 * sequence is carried by the snap points instead.
 */
export function PinnedHero({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  return (
    <>
      <section className="snap-section relative h-[100dvh] overflow-hidden border-b border-border">
        {hero}
      </section>
      {children}
    </>
  )
}
