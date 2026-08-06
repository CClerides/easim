'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import MarqueeAlongSvgPath from '@/components/ui/marquee-along-svg-path'
import { destinationFor } from '@/lib/destinations'
import type { Plan } from '@/lib/plans'

/**
 * The eight destinations, drifting along a curve above the catalogue.
 *
 * The photographs are the only thing on this site that shows you where you are
 * actually going - everything else is data allowances and prices. So they get
 * to be the first thing on the page, and each one is a link to the plan it
 * belongs to rather than decoration.
 *
 * Two things had to be handled to make that work:
 *
 *   The marquee is draggable, and a drag ends in a click. Without the guard
 *   below, letting go after shoving the strip sideways navigates you to
 *   whichever photo happened to be under the cursor. The click is suppressed
 *   if the pointer travelled more than a few pixels, which is the same
 *   threshold a carousel uses to tell a swipe from a tap.
 *
 *   Under `prefers-reduced-motion` the velocity drops to zero. A perpetually
 *   moving strip is exactly the kind of thing that setting exists to stop, and
 *   at zero the items simply sit along the curve as a static arc - the layout
 *   still reads, it just holds still.
 */
export function DestinationMarquee({ plans }: { plans: Plan[] }) {
  const reduce = useReducedMotion()
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(event: React.PointerEvent) {
    pointerDownAt.current = { x: event.clientX, y: event.clientY }
  }

  function handleClickCapture(event: React.MouseEvent) {
    const start = pointerDownAt.current
    if (!start) return
    const travelled = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (travelled > 6) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <div
      onPointerDownCapture={handlePointerDown}
      onClickCapture={handleClickCapture}
      className="relative h-[260px] w-full sm:h-[320px] lg:h-[360px]"
    >
      <MarqueeAlongSvgPath
        path={PATH}
        viewBox="0 0 996 330"
        baseVelocity={reduce ? 0 : 6}
        slowdownOnHover
        slowDownFactor={0.15}
        draggable={!reduce}
        grabCursor={!reduce}
        dragSensitivity={0.1}
        repeat={2}
        responsive
        className="h-full w-full"
      >
        {plans.map((plan) => {
          const destination = destinationFor(plan.slug)

          return (
            <Link
              key={plan.id}
              href={`/plans/${plan.slug}`}
              className="group block h-[104px] w-[78px] overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(16,19,24,0.16)] ring-1 ring-black/5 transition-transform duration-300 ease-out hover:scale-125 focus-visible:scale-125"
            >
              <Image
                src={destination.image}
                alt={`${plan.region} - ${destination.city}`}
                width={156}
                height={208}
                sizes="78px"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </Link>
          )
        })}
      </MarqueeAlongSvgPath>
    </div>
  )
}

/**
 * The curve itself, from the component's own demo. It rises, loops back on
 * itself and runs out to the right, which gives the items somewhere to overlap
 * - that overlap is what the rolling z-index in the component is for.
 */
const PATH =
  'M1 209.434C58.5872 255.935 387.926 325.938 482.583 209.434C600.905 63.8051 525.516 -43.2211 427.332 19.9613C329.149 83.1436 352.902 242.723 515.041 267.302C644.752 286.966 943.56 181.94 995 156.5'
