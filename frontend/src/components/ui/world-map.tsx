'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'

/**
 * A dotted world map with animated routes drawn across it.
 *
 * Adapted from the 21st.dev `world-map` component, with three changes:
 *
 *   The dotted basemap SVG is generated on the server and passed in as a
 *   string. The original builds it in the browser, which ships the whole
 *   `dotted-map` package plus its coastline data to every visitor for
 *   something that never changes. Generating it once on the server keeps it
 *   out of the client bundle entirely.
 *
 *   `next-themes` is dropped. This site is a single committed dark theme, so
 *   a runtime theme lookup would be a dependency and a hydration mismatch in
 *   exchange for a branch that can only ever go one way.
 *
 *   `framer-motion` becomes `motion/react`, which is the same library under
 *   its current name and already in this project. Installing the legacy alias
 *   alongside it would ship two copies.
 *
 * The arcs are not decoration: each one is a real route from a hub to a
 * destination this shop actually sells.
 */
export type Route = {
  start: { lat: number; lng: number }
  end: { lat: number; lng: number }
  label?: string
}

/** The component's own projection, matching the 800x400 viewBox. */
function project(lat: number, lng: number) {
  return { x: (lng + 180) * (800 / 360), y: (90 - lat) * (400 / 180) }
}

function curve(start: { x: number; y: number }, end: { x: number; y: number }) {
  const midX = (start.x + end.x) / 2
  const midY = Math.min(start.y, end.y) - 50
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`
}

export function WorldMap({
  svgMap,
  routes,
  lineColor = 'var(--accent)',
}: {
  svgMap: string
  routes: Route[]
  lineColor?: string
}) {
  const reduce = useReducedMotion()

  return (
    <div className="relative aspect-[2/1] w-full font-sans">
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        alt=""
        width={1056}
        height={495}
        draggable={false}
        priority
        className="pointer-events-none h-full w-full [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] select-none"
      />

      <svg
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        aria-hidden
      >
        <defs>
          <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0" />
            <stop offset="12%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="88%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {routes.map((route, index) => {
          const start = project(route.start.lat, route.start.lng)
          const end = project(route.end.lat, route.end.lng)

          return (
            <g key={`${route.label ?? index}`}>
              <motion.path
                d={curve(start, end)}
                fill="none"
                stroke="url(#route-gradient)"
                strokeWidth="1"
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, delay: index * 0.18, ease: [0.23, 1, 0.32, 1] }}
              />

              <circle cx={start.x} cy={start.y} r="2" fill={lineColor} />
              <circle cx={end.x} cy={end.y} r="2" fill={lineColor} />

              {/*
                The pulse is the only looping animation on the site, and it is
                gated: an infinite loop is exactly what a reader asking for
                reduced motion wants stopped.
              */}
              {reduce ? null : (
                <circle cx={end.x} cy={end.y} r="2" fill={lineColor} opacity="0.5">
                  <animate
                    attributeName="r"
                    from="2"
                    to="9"
                    dur="1.8s"
                    begin={`${index * 0.25}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.5"
                    to="0"
                    dur="1.8s"
                    begin={`${index * 0.25}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
