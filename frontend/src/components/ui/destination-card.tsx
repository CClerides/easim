'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import type { Plan } from '@/lib/plans'
import { destinationFor } from '@/lib/destinations'
import { formatData, formatDuration, formatPrice } from '@/lib/format'
import { spring, springQuick } from '@/lib/motion'

/**
 * A destination, as a card that opens a map when you point at it.
 *
 * Adapted from the 21st.dev `expanded-map` component, with four changes that
 * matter:
 *
 *   It expands on hover rather than on click, because click is spent: this is
 *   a product card and clicking it has to take you to the product.
 *
 *   The whole card is a link. Hover is progressive enhancement layered on top
 *   of a plain anchor, so it still works on a phone, with a keyboard, and with
 *   JavaScript switched off.
 *
 *   It uses this project's tokens instead of the component's emerald demo
 *   palette. Two accent colours on one page is one too many.
 *
 *   It sizes to its grid cell instead of animating fixed pixel widths. A card
 *   that animates from 240px to 360px inside a responsive grid fights the
 *   layout and reflows its neighbours.
 */

const TILE_PX = 256

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

/** Carto's dark basemap, because the site is dark and a bright map would shout. */
function tileUrl(x: number, y: number, z: number) {
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/${z}/${x}/${y}.png`
}

export function DestinationCard({
  plan,
  available,
}: {
  plan: Plan
  available: number | undefined
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const destination = destinationFor(plan.slug)
  const soldOut = available === 0

  /**
   * A little parallax tilt toward the cursor.
   *
   * Driven by motion values rather than React state on purpose: state would
   * re-render the whole card on every pointer move, which drops frames on a
   * grid of eight. The spring is what stops it feeling like the card is glued
   * rigidly to the mouse.
   */
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const rotateX = useSpring(useTransform(pointerY, [-60, 60], [4, -4]), {
    stiffness: 260,
    damping: 28,
  })
  const rotateY = useSpring(useTransform(pointerX, [-60, 60], [-4, 4]), {
    stiffness: 260,
    damping: 28,
  })

  const tiles = useMemo(() => {
    const center = latLngToTile(destination.latitude, destination.longitude, destination.zoom)
    const grid: { url: string; dx: number; dy: number }[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        grid.push({ url: tileUrl(center.x + dx, center.y + dy, destination.zoom), dx, dy })
      }
    }
    return grid
  }, [destination])

  function handlePointerMove(event: React.PointerEvent) {
    if (reduce) return
    const rect = event.currentTarget.getBoundingClientRect()
    pointerX.set(event.clientX - (rect.left + rect.width / 2))
    pointerY.set(event.clientY - (rect.top + rect.height / 2))
  }

  function handleLeave() {
    pointerX.set(0)
    pointerY.set(0)
    setOpen(false)
  }

  return (
    <motion.div
      style={{ perspective: 1000 }}
      // An expanded card overflows its grid cell, so it has to sit above the
      // row beneath it rather than growing underneath it.
      className={`h-full ${open ? 'relative z-20' : ''}`}
    >
      <Link
        href={`/plans/${plan.slug}`}
        aria-label={`${plan.region}, ${formatData(plan.data_mb)} for ${formatDuration(plan.duration_days)}, ${formatPrice(plan.price_cents)}`}
        onPointerMove={handlePointerMove}
        onPointerEnter={(event) => {
          // Only a real cursor opens the card. On a touch screen the first tap
          // would otherwise open it instead of following the link.
          if (event.pointerType === 'mouse') setOpen(true)
        }}
        onPointerLeave={handleLeave}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="block h-full"
      >
        <motion.article
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
          animate={{ height: open && !reduce ? 300 : 188 }}
          transition={spring}
          className="relative flex h-full flex-col justify-between overflow-hidden rounded-container border border-border bg-surface p-5 transition-colors duration-200 hover:border-accent/60"
        >
          <AnimatePresence>
            {open ? (
              <motion.div
                key="map"
                className="pointer-events-none absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute top-1/2 left-1/2"
                    style={{
                      width: TILE_PX * 3,
                      height: TILE_PX * 3,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {tiles.map((tile) => (
                      <NextImage
                        key={tile.url}
                        src={tile.url}
                        alt=""
                        width={TILE_PX}
                        height={TILE_PX}
                        unoptimized
                        className="absolute opacity-70"
                        style={{
                          left: (tile.dx + 1) * TILE_PX,
                          top: (tile.dy + 1) * TILE_PX,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Keeps the price and region legible over whatever the map is. */}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-surface/30" />

                <motion.span
                  aria-hidden
                  className="absolute top-1/2 left-1/2 block size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-4 ring-accent/25"
                  // Never from scale(0) - nothing in the world appears out of
                  // nothing. 0.6 still reads as arriving.
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springQuick}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{plan.region}</h3>
              <p className="mt-1 text-sm text-muted">
                {formatData(plan.data_mb)} · {formatDuration(plan.duration_days)}
              </p>
            </div>
            <StockBadge available={available} />
          </div>

          <div className="relative">
            <AnimatePresence>
              {open ? (
                <motion.p
                  key="city"
                  className="mb-3 font-mono text-xs text-muted"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  {destination.city}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <div className="flex items-end justify-between gap-3">
              <p className="text-2xl font-semibold tabular-nums">
                {formatPrice(plan.price_cents)}
              </p>
              <span className="text-sm text-muted">{soldOut ? 'Unavailable' : 'View plan'}</span>
            </div>
          </div>
        </motion.article>
      </Link>
    </motion.div>
  )
}

/** Below this many left, say so. Scarcity here is real, not a growth tactic. */
const LOW_STOCK = 3

function StockBadge({ available }: { available: number | undefined }) {
  if (available === undefined) return null

  const tone =
    available === 0
      ? 'border-danger/40 text-danger'
      : available <= LOW_STOCK
        ? 'border-warning/40 text-warning'
        : 'border-border text-muted'

  const label = available === 0 ? 'Sold out' : available <= LOW_STOCK ? `${available} left` : 'In stock'

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  )
}
