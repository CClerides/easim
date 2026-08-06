/**
 * Where each plan puts you on a map.
 *
 * Kept in the frontend rather than the database on purpose: a coordinate is a
 * presentation detail of the marketing page, not a fact about the product. A
 * plan is defined by its data, duration and price. Adding a `latitude` column
 * would mean a migration for something only one card component reads.
 *
 * Regional plans point at the city a traveller most likely lands in. The
 * global plan has no single point, so it gets a low zoom and sits over the
 * Atlantic where the most landmass is visible at once.
 */
export type Destination = {
  city: string
  latitude: number
  longitude: number
  zoom: number
}

const DESTINATIONS: Record<string, Destination> = {
  'europe-5gb-15d': { city: 'Paris', latitude: 48.8566, longitude: 2.3522, zoom: 11 },
  'japan-10gb-30d': { city: 'Tokyo', latitude: 35.6762, longitude: 139.6503, zoom: 11 },
  'usa-3gb-7d': { city: 'New York', latitude: 40.7128, longitude: -74.006, zoom: 11 },
  'global-20gb-30d': { city: 'Worldwide', latitude: 25, longitude: -20, zoom: 3 },
  'turkey-10gb-15d': { city: 'Istanbul', latitude: 41.0082, longitude: 28.9784, zoom: 11 },
  'uae-5gb-7d': { city: 'Dubai', latitude: 25.2048, longitude: 55.2708, zoom: 11 },
  'thailand-8gb-15d': { city: 'Bangkok', latitude: 13.7563, longitude: 100.5018, zoom: 11 },
  'mexico-5gb-30d': { city: 'Mexico City', latitude: 19.4326, longitude: -99.1332, zoom: 11 },
}

/** Falls back to a world view so an unknown slug still renders a card. */
export function destinationFor(slug: string): Destination {
  return DESTINATIONS[slug] ?? { city: 'Worldwide', latitude: 25, longitude: -20, zoom: 3 }
}
