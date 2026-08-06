'use client'

import { useEffect } from 'react'

/**
 * Turns section snapping on for one page only.
 *
 * Snapping has to be set on the element that actually scrolls - the document -
 * and a page component cannot style `<html>`. This adds the class on mount and
 * takes it away on unmount, so the landing page snaps and the rest of the site,
 * including the entire checkout, scrolls normally.
 */
export function SnapScope() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('snap-sections')
    return () => root.classList.remove('snap-sections')
  }, [])

  return null
}
