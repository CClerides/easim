/**
 * How much of a plan is left.
 *
 * The pool of eSIM profiles behind each plan is finite and small, so scarcity
 * here is a fact rather than a growth tactic - and a plan that sells out
 * between browsing and checkout is a real failure path this shop has to show
 * honestly.
 *
 * Rendered over a photograph on the destination cards, so it carries its own
 * dark backing rather than relying on the surface beneath it.
 */

/** Below this many left, say so. */
const LOW_STOCK_THRESHOLD = 3

export function StockBadge({ available }: { available: number | undefined }) {
  // Undefined means the count could not be read. Saying nothing is better than
  // guessing, so the badge simply does not render.
  if (available === undefined) return null

  if (available === 0) return <Badge>Sold out</Badge>
  if (available <= LOW_STOCK_THRESHOLD) return <Badge>{available} left</Badge>
  return <Badge>In stock</Badge>
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-xs whitespace-nowrap text-white backdrop-blur-sm">
      {children}
    </span>
  )
}
