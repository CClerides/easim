'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

/**
 * The product, as something you can push around.
 *
 * A hero image that only sits there is a picture. This one tilts toward the
 * pointer in 3D, catches a highlight that tracks the same position, and
 * settles on a spring when you let go - which is the difference between
 * looking at a photograph of a card and looking at a card.
 *
 * Three implementation notes that matter:
 *
 *   Pointer position drives motion values, never React state. State would
 *   re-render the subtree on every pointer move and drop frames; motion
 *   values write straight to the compositor.
 *
 *   The springs are what stop it feeling rigidly glued to the cursor. Raw
 *   pointer tracking reads as mechanical because real objects have mass.
 *
 *   Only `transform` and `opacity` animate, so the whole thing stays on the
 *   GPU.
 *
 * Under reduced motion it is simply the image, with no tilt and no listeners
 * attached at all.
 */
export function SimCard3D() {
  const frame = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)

  const springs = { stiffness: 220, damping: 26, mass: 0.7 }
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [12, -12]), springs)
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-16, 16]), springs)
  const lift = useSpring(useTransform(pointerY, [-0.5, 0.5], [-8, 8]), springs)

  // The highlight sweeps with the tilt, which is what sells it as a surface
  // catching light rather than a flat image being rotated.
  const glareX = useTransform(pointerX, [-0.5, 0.5], ['20%', '80%'])
  const glareY = useTransform(pointerY, [-0.5, 0.5], ['15%', '85%'])

  // Derived up here rather than inline in the JSX below, because the JSX sits
  // after the reduced-motion early return - a hook down there would run on
  // some renders and not others.
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) =>
      `radial-gradient(38% 46% at ${x} ${y}, rgba(255,255,255,0.55), transparent 70%)`,
  )

  function handleMove(event: React.PointerEvent) {
    const rect = frame.current?.getBoundingClientRect()
    if (!rect) return
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function reset() {
    pointerX.set(0)
    pointerY.set(0)
  }

  if (reduce) {
    return (
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-container">
        <Image
          src="/brand/sim-card.webp"
          alt="An Easim eSIM card"
          width={1400}
          height={800}
          priority
          className="h-auto w-full origin-top-left scale-[1.1]"
        />
      </div>
    )
  }

  return (
    <div
      ref={frame}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ perspective: 1200 }}
      className="mx-auto w-full max-w-3xl"
    >
      {/*
        Presented as a product tile rather than a floating cut-out.
        Background removal left the studio backdrop attached to the subject, and
        a grey rectangle sitting on a white page reads as a mistake. Framing it
        makes the backdrop deliberate, and scaling from the top-left corner
        pushes the generator's watermark out of the bottom-right crop.
      */}
      <motion.div
        style={{ rotateX, rotateY, y: lift, transformStyle: 'preserve-3d' }}
        className="relative overflow-hidden rounded-container shadow-[0_40px_90px_rgba(16,19,24,0.20)]"
      >
        <Image
          src="/brand/sim-card.webp"
          alt="An Easim eSIM card"
          width={1400}
          height={800}
          priority
          className="h-auto w-full origin-top-left scale-[1.1]"
        />

        {/* The moving highlight. Decorative, so it is hidden from the tree. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{ background: glare }}
        />
      </motion.div>
    </div>
  )
}
