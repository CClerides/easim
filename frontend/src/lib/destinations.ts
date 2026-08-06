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
  latitude: number
  longitude: number
  zoom: number
  /**
   * The photograph for this destination, under `public/`.
   *
   * Written out per slug rather than derived from the region name, because the
   * files are not consistently named: two are `.jpeg` and six are `.jpg`, and
   * `USA` and `UAE` are uppercase while the rest are not. A clever
   * `/${region.toLowerCase()}.jpg` would silently 404 on three of the eight.
   */
  image: string
  /**
   * What the photograph shows, for anyone who cannot see it.
   *
   * Not the place name on its own: a screen reader announcing "Paris" inside a
   * card already titled "Europe" adds nothing. These describe the image.
   */
  imageAlt: string
  /**
   * One line of why you would buy this plan, shown on the destination card.
   *
   * Copy, not data, so it lives here beside the photograph rather than in the
   * database. A plan is its data, duration and price; how we describe the trip
   * is a property of the marketing page.
   */
  overview: string
}

const FALLBACK: Destination = {
  // Worldwide
  latitude: 25,
  longitude: -20,
  zoom: 3,
  image: '/global.jpg',
  imageAlt: 'A view of the Earth from orbit',
  overview: 'Data that follows you wherever the plan takes you.',
}

const DESTINATIONS: Record<string, Destination> = {
  'europe-5gb-15d': {
    // Paris
    latitude: 48.8566,
    longitude: 2.3522,
    zoom: 11,
    image: '/europe.jpeg',
    imageAlt: 'A montage of European landmarks - the Colosseum, the Alhambra, the Eiffel Tower and the Acropolis',
    overview:
      'One plan for the whole trip. It keeps working when you cross a border, so Paris to Lisbon costs you nothing extra.',
  },
  'japan-10gb-30d': {
    // Tokyo
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 11,
    image: '/japan.jpg',
    imageAlt: 'A red pagoda in blossom with Mount Fuji behind it',
    overview:
      'Enough data for a month of maps, translation and train times, in a country where public Wi-Fi rarely obliges.',
  },
  'usa-3gb-7d': {
    // New York
    latitude: 40.7128,
    longitude: -74.006,
    zoom: 11,
    image: '/USA.jpg',
    imageAlt: 'The Statue of Liberty with the Manhattan skyline behind it',
    overview:
      'Enough for a short trip. Rideshares, boarding passes and directions, without a week-long plan you will not finish.',
  },
  'global-20gb-30d': {
    // Worldwide
    latitude: 25,
    longitude: -20,
    zoom: 3,
    image: '/global.jpg',
    imageAlt: 'A view of the Earth from orbit',
    overview:
      'One eSIM for every leg. Buy it once and stop thinking about coverage for the rest of the itinerary.',
  },
  'turkey-10gb-15d': {
    // Istanbul
    latitude: 41.0082,
    longitude: 28.9784,
    zoom: 11,
    image: '/turkey.jpg',
    imageAlt: 'Hot air balloons rising over the rock valleys of Cappadocia',
    overview:
      'Two weeks of generous data, for a country big enough that you will want to cross it rather than sit still.',
  },
  'uae-5gb-7d': {
    // Dubai
    latitude: 25.2048,
    longitude: 55.2708,
    zoom: 11,
    image: '/UAE.jpeg',
    imageAlt: 'The towers of Dubai Marina curving around the water',
    overview:
      'Connected the moment you land, so the ride to the hotel is booked before you reach the taxi rank.',
  },
  'thailand-8gb-15d': {
    // Bangkok
    latitude: 13.7563,
    longitude: 100.5018,
    zoom: 11,
    image: '/thailand.jpg',
    imageAlt: 'A limestone cliff rising from turquoise water, with a longtail boat below',
    overview:
      'Island-hopping data. Enough to keep maps and messages running well past the last stretch of hotel Wi-Fi.',
  },
  'mexico-5gb-30d': {
    // Mexico City
    latitude: 19.4326,
    longitude: -99.1332,
    zoom: 11,
    image: '/mexico.jpg',
    imageAlt: 'A Mexican flag flying over a tree-lined avenue in Mexico City',
    overview:
      'A full month at a price that suits a long stay rather than a weekend.',
  },
}

/** Falls back to a world view so an unknown slug still renders a card. */
export function destinationFor(slug: string): Destination {
  return DESTINATIONS[slug] ?? FALLBACK
}
