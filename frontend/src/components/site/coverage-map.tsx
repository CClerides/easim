import DottedMap from 'dotted-map'
import { WorldMap, type Route } from '@/components/ui/world-map'
import { destinationFor } from '@/lib/destinations'
import type { Plan } from '@/lib/plans'

/**
 * The coverage section, generated on the server.
 *
 * `dotted-map` carries its own coastline data, so building the basemap in the
 * browser would ship that to every visitor for an image that never changes.
 * It is rendered to an SVG string here, once, and handed to the client
 * component that animates the routes over it.
 *
 * The arcs are real: each one runs from a European hub to a destination this
 * shop actually sells, so the picture tells the truth about the catalogue
 * rather than being generic connectivity decoration.
 */

/** Frankfurt. Where a European traveller most often starts. */
const HUB = { lat: 50.1109, lng: 8.6821 }

export function CoverageMap({ plans }: { plans: Plan[] }) {
  const map = new DottedMap({ height: 100, grid: 'diagonal' })

  const svgMap = map.getSVG({
    radius: 0.22,
    // Dots matched to the page's border token rather than a flat grey, so the
    // landmass reads as part of the interface instead of a pasted-in graphic.
    color: '#2b303a',
    shape: 'circle',
    backgroundColor: 'transparent',
  })

  const routes: Route[] = plans
    // The global plan has no single endpoint, so it would draw an arc to an
    // arbitrary point in the Atlantic and imply something untrue.
    .filter((plan) => plan.slug !== 'global-20gb-30d')
    .map((plan) => {
      const destination = destinationFor(plan.slug)
      return {
        start: HUB,
        end: { lat: destination.latitude, lng: destination.longitude },
        label: plan.slug,
      }
    })

  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <div className="text-center">
        <h2 className="text-3xl font-semibold sm:text-4xl">
          Seven countries, one eSIM each
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Every line is a plan you can buy on this page, not a coverage claim.
        </p>
      </div>

      <div className="mt-10">
        <WorldMap svgMap={svgMap} routes={routes} />
      </div>
    </div>
  )
}
