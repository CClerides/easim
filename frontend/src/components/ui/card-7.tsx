import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The 21st.dev `card-7` travel card.
 *
 * The design is untouched: a photograph that zooms on hover, a dark gradient
 * holding the type, the details sliding up and the price and call to action
 * rising in from below. Four things about the published source had to change
 * to make it a real product card in this shop, and each is worth knowing:
 *
 *   `onBookNow: () => void` became `href`. A card that navigates should be a
 *   link, not a button that calls `router.push`. A link opens in a new tab on
 *   middle click, previews on hover, is announced as a link, and works before
 *   any JavaScript arrives. That change also removes the component's need for
 *   `useRouter`, which is what keeps it a Server Component - the whole plans
 *   page ships no JavaScript for these cards, because the hover is CSS.
 *
 *   `React.forwardRef` is dropped for the same reason. Nothing here needs a
 *   ref, and a `forwardRef` component cannot be a Server Component, so keeping
 *   the boilerplate would have cost the page its zero-JS rendering.
 *
 *   `<img>` became `next/image`. The source photographs run to 3 MB; eight of
 *   them unoptimised is a slow page on a phone, which is the device someone
 *   buys travel data on.
 *
 *   `price` takes a formatted string rather than a number. The original
 *   renders `${price}`, and this shop prices in euro. Passing a number would
 *   also print "€14.9" for a plan that costs €14.90.
 *
 * The reveal is gated on the project's `hoverable:` variant - `(hover: hover)`,
 * declared in globals.css. Tailwind's `hover:` already only fires on devices
 * with a real pointer, which is exactly why the published component fails on a
 * phone: nothing ever hovers, so the price and the button stay permanently
 * off-card - the two things a buyer most needs. Here they start visible, and
 * only hide on machines that can hover, where the reveal is a flourish rather
 * than the sole route to the price.
 *
 * Those variant classes are written out in full rather than composed from a
 * constant. Tailwind scans source files for literal class strings; a name
 * assembled at runtime produces no CSS at all, and the component silently
 * renders in its unstyled state.
 */

interface TravelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl: string
  imageAlt: string
  logo?: React.ReactNode
  /**
   * Sits opposite the logo. The published component already lays that row out
   * with `justify-between` and puts nothing on the right; this is that slot.
   */
  badge?: React.ReactNode
  title: string
  /**
   * A quiet line under the title. Optional: the plans page has nothing true to
   * put here, since these plans cover regions rather than the cities their map
   * coordinates point at.
   */
  location?: string
  overview: string
  /** Preformatted, including the currency symbol. */
  price: string
  pricePeriod: string
  /** Where the call to action goes. Omitted when `soldOut`. */
  href?: string
  ctaLabel?: string
  /** Replaces the call to action with a plain, unclickable label. */
  soldOut?: boolean
  /** Loads this card's photograph eagerly; use it for the ones above the fold. */
  priority?: boolean
}

function TravelCard({
  className,
  imageUrl,
  imageAlt,
  logo,
  badge,
  title,
  location,
  overview,
  price,
  pricePeriod,
  href,
  ctaLabel = 'Book Now',
  soldOut = false,
  priority = false,
  ...props
}: TravelCardProps) {
  return (
    <div
      className={cn(
        'group relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-lg',
        'transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-2',
        'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2',
        className,
      )}
      {...props}
    >
      {/* Background image with zoom effect on hover */}
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        // Three columns at the page's 1152px maximum, one per row on a phone.
        sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw"
        priority={priority}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-in-out',
          'hoverable:group-hover:scale-110',
        )}
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Content container */}
      <div className="relative flex h-full flex-col justify-between p-6 text-card-foreground">
        {/* Top section: logo, and whatever the caller puts opposite it */}
        <div className="flex h-40 items-start justify-between gap-3">
          {logo && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/50 bg-black/20 backdrop-blur-sm">
              {logo}
            </div>
          )}
          {badge}
        </div>

        {/*
          Middle section: details, sliding up to make room for the price.

          The resting position is already shifted up, because on a device that
          cannot hover the price below is permanently visible and the two would
          otherwise print on top of each other. Only where a pointer exists
          does this sit low and rise on hover.
        */}
        <div
          className={cn(
            '-translate-y-16 space-y-4 transition-transform duration-500 ease-in-out',
            'hoverable:translate-y-0',
            'hoverable:group-hover:-translate-y-16 hoverable:group-focus-within:-translate-y-16',
          )}
        >
          <div>
            <h3 className="text-3xl font-bold text-white">{title}</h3>
            {location && <p className="text-sm text-white/80">{location}</p>}
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-wider text-white/90">OVERVIEW</h4>
            <p className="text-sm leading-relaxed text-white/70">{overview}</p>
          </div>
        </div>

        {/*
          Bottom section: price and action.
          Visible by default, because a touch device never hovers. Only where a
          pointer exists does it start off-card and rise in.
        */}
        <div
          className={cn(
            'absolute bottom-0 left-0 w-full p-6 opacity-100 transition-all duration-500 ease-in-out',
            'hoverable:-bottom-20 hoverable:opacity-0',
            'hoverable:group-hover:bottom-0 hoverable:group-hover:opacity-100',
            'hoverable:group-focus-within:bottom-0 hoverable:group-focus-within:opacity-100',
          )}
        >
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="text-4xl font-bold text-white tabular-nums">{price}</span>
              <span className="block text-sm text-white/80">{pricePeriod}</span>
            </div>

            {soldOut || !href ? (
              <span className="shrink-0 rounded-full border border-white/50 px-4 py-2 text-sm font-medium text-white/90">
                Sold out
              </span>
            ) : (
              <Link
                href={href}
                // The title goes in the label because eight cards of "View
                // plan" are eight identical links to anyone reading the page
                // by its links alone.
                aria-label={`${ctaLabel} - ${title}`}
                className="inline-flex shrink-0 items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { TravelCard }
