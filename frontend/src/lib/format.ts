/**
 * Display formatting.
 *
 * Money and data volume are stored as integers — cents and megabytes — and
 * turned into human strings only here, at the last moment before rendering.
 * Keeping the conversion in one place is what stops "€14.9" appearing on one
 * page and "14.90 EUR" on another.
 */

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPrice(cents: number): string {
  return euro.format(cents / 100)
}

export function formatData(megabytes: number): string {
  if (megabytes < 1024) return `${megabytes} MB`

  const gigabytes = megabytes / 1024
  // 5120 MB should read "5 GB", not "5.0 GB", but 1536 MB is honestly 1.5 GB.
  return Number.isInteger(gigabytes) ? `${gigabytes} GB` : `${gigabytes.toFixed(1)} GB`
}

export function formatDuration(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}
