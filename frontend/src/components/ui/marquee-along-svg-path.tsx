'use client'

import React, { RefObject, useCallback, useEffect, useId, useRef } from 'react'
import {
  motion,
  MotionValue,
  SpringOptions,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'

import { cn } from '@/lib/utils'

/**
 * The 21st.dev `marquee-along-svg-path` component.
 *
 * Three changes from the published source, all forced by this codebase rather
 * than by taste. The API and the behaviour are unchanged.
 *
 *   The per-item hooks moved out of the `.map()` into `MarqueeItem`. The
 *   original calls `useTransform`, `useMotionValue` and `useEffect` inside a
 *   loop, which breaks the Rules of Hooks: React identifies hooks by call
 *   order, so the moment the child count or `repeat` changes, every item's
 *   state is read from the wrong slot. It survives in the demo because that
 *   list is a hard-coded constant. Ours comes from the database. It is also a
 *   hard `react-hooks/rules-of-hooks` lint error, so it would not build.
 *
 *   `useId()` replaces `Math.random()` for the generated path id. A random
 *   value computed during render produces a different id on the server than in
 *   the browser, which is a hydration mismatch on every page this appears on.
 *   The published component is client-only, so it never hit this.
 *
 *   `'use client'` added, since this project is a Server Component app by
 *   default and the file is nothing but hooks and pointer events.
 *
 * The unused `itemRefs` map from the original is dropped - nothing ever read
 * it.
 */

// Custom wrap function
const wrap = (min: number, max: number, value: number): number => {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

type PreserveAspectRatioAlign =
  | 'none'
  | 'xMinYMin'
  | 'xMidYMin'
  | 'xMaxYMin'
  | 'xMinYMid'
  | 'xMidYMid'
  | 'xMaxYMid'
  | 'xMinYMax'
  | 'xMidYMax'
  | 'xMaxYMax'

interface CSSVariableInterpolation {
  property: string
  from: number | string
  to: number | string
}

type PreserveAspectRatioMeetOrSlice = 'meet' | 'slice'

type PreserveAspectRatio =
  | PreserveAspectRatioAlign
  | `${Exclude<PreserveAspectRatioAlign, 'none'>} ${PreserveAspectRatioMeetOrSlice}`

interface MarqueeAlongSvgPathProps {
  children: React.ReactNode
  className?: string

  // Path properties
  path: string
  pathId?: string
  preserveAspectRatio?: PreserveAspectRatio
  showPath?: boolean

  // SVG properties
  width?: string | number
  height?: string | number
  viewBox?: string

  // Marquee properties
  baseVelocity?: number
  direction?: 'normal' | 'reverse'
  easing?: (value: number) => number
  slowdownOnHover?: boolean
  slowDownFactor?: number
  slowDownSpringConfig?: SpringOptions

  // Scroll properties
  useScrollVelocity?: boolean
  scrollAwareDirection?: boolean
  scrollSpringConfig?: SpringOptions
  scrollContainer?: RefObject<HTMLElement | null> | HTMLElement | null

  // Item repetition
  repeat?: number

  // Drag properties
  draggable?: boolean
  dragSensitivity?: number
  dragVelocityDecay?: number
  dragAwareDirection?: boolean
  grabCursor?: boolean

  // Z-index properties
  enableRollingZIndex?: boolean
  zIndexBase?: number
  zIndexRange?: number

  cssVariableInterpolation?: CSSVariableInterpolation[]

  // Responsive properties
  responsive?: boolean
}

const MarqueeAlongSvgPath = ({
  children,
  className,

  // Path defaults
  path,
  pathId,
  preserveAspectRatio = 'xMidYMid meet',
  showPath = false,

  // SVG defaults
  width = '100%',
  height = '100%',
  viewBox = '0 0 100 100',

  // Marquee defaults
  baseVelocity = 5,
  direction = 'normal',
  easing,
  slowdownOnHover = false,
  slowDownFactor = 0.3,
  slowDownSpringConfig = { damping: 50, stiffness: 400 },

  // Scroll defaults
  useScrollVelocity = false,
  scrollAwareDirection = false,
  scrollSpringConfig = { damping: 50, stiffness: 400 },
  scrollContainer,

  // Items repetition
  repeat = 3,

  // Drag defaults
  draggable = false,
  dragSensitivity = 0.2,
  dragVelocityDecay = 0.96,
  dragAwareDirection = false,
  grabCursor = false,

  // Z-index defaults
  enableRollingZIndex = true,
  zIndexBase = 1, // Base z-index value
  zIndexRange = 10, // Range of z-index values to use

  cssVariableInterpolation = [],

  // Responsive defaults
  responsive = false,
}: MarqueeAlongSvgPathProps) => {
  const container = useRef<HTMLDivElement>(null)
  const marqueeContainerRef = useRef<HTMLDivElement>(null)
  const baseOffset = useMotionValue(0)

  const pathRef = useRef<SVGPathElement>(null)

  // Responsive scaling using direct DOM manipulation (no re-renders)
  useEffect(() => {
    if (!responsive) return

    const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number)
    const originalWidth = vbWidth || 100
    const originalHeight = vbHeight || 100

    const updateScale = () => {
      const wrapper = container.current
      const marqueeContainer = marqueeContainerRef.current
      if (!wrapper || !marqueeContainer) return

      const wrapperWidth = wrapper.clientWidth
      const wrapperHeight = wrapper.clientHeight

      const scaleX = wrapperWidth / originalWidth
      const scaleY = wrapperHeight / originalHeight
      const scale = Math.min(scaleX, scaleY)

      // Calculate the scaled dimensions
      const scaledWidth = originalWidth * scale
      const scaledHeight = originalHeight * scale

      // Center the marquee container within the wrapper
      const offsetX = (wrapperWidth - scaledWidth) / 2
      const offsetY = (wrapperHeight - scaledHeight) / 2

      // Set fixed dimensions on the container
      marqueeContainer.style.width = `${originalWidth}px`
      marqueeContainer.style.height = `${originalHeight}px`

      // Apply scale and position to center
      marqueeContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
      marqueeContainer.style.transformOrigin = 'top left'
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [responsive, viewBox])

  // Create an array of items outside of the render function
  const items = React.useMemo(() => {
    const childrenArray = React.Children.toArray(children)

    return childrenArray.flatMap((child, childIndex) =>
      Array.from({ length: repeat }, (_, repeatIndex) => {
        const itemIndex = repeatIndex * childrenArray.length + childIndex
        const key = `${childIndex}-${repeatIndex}`
        return {
          child,
          childIndex,
          repeatIndex,
          itemIndex,
          key,
        }
      }),
    )
  }, [children, repeat])

  // Function to calculate z-index based on offset distance
  const calculateZIndex = useCallback(
    (offsetDistance: number) => {
      if (!enableRollingZIndex) {
        return undefined
      }

      // Simple progress-based z-index
      const normalizedDistance = offsetDistance / 100
      return Math.floor(zIndexBase + normalizedDistance * zIndexRange)
    },
    [enableRollingZIndex, zIndexBase, zIndexRange],
  )

  // Stable across server and client, unlike the original's Math.random().
  const generatedId = useId()
  const id = pathId || `marquee-path-${generatedId}`

  // Scroll tracking
  const { scrollY } = useScroll({
    container: (scrollContainer as RefObject<HTMLDivElement | null>) || container,
  })

  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, scrollSpringConfig)

  // Hover and drag state tracking
  const isHovered = useRef(false)
  const isDragging = useRef(false)
  const dragVelocity = useRef(0)

  // Direction factor for changing direction based on scroll or drag
  const directionFactor = useRef(direction === 'normal' ? 1 : -1)

  // Motion values for animation
  const hoverFactorValue = useMotionValue(1)
  const defaultVelocity = useMotionValue(1)
  const smoothHoverFactor = useSpring(hoverFactorValue, slowDownSpringConfig)

  // Transform scroll velocity into a factor that affects marquee speed
  const velocityFactor = useTransform(
    useScrollVelocity ? smoothVelocity : defaultVelocity,
    [0, 1000],
    [0, 5],
    { clamp: false },
  )

  // Animation frame handler
  useAnimationFrame((_, delta) => {
    if (isDragging.current && draggable) {
      baseOffset.set(baseOffset.get() + dragVelocity.current)

      // Add decay to dragVelocity
      dragVelocity.current *= 0.9

      // Stop completely if velocity is very small
      if (Math.abs(dragVelocity.current) < 0.01) {
        dragVelocity.current = 0
      }

      return
    }

    // Update hover factor
    if (isHovered.current) {
      hoverFactorValue.set(slowdownOnHover ? slowDownFactor : 1)
    } else {
      hoverFactorValue.set(1)
    }

    // Calculate regular movement
    let moveBy =
      directionFactor.current * baseVelocity * (delta / 1000) * smoothHoverFactor.get()

    // Adjust movement based on scroll velocity if scrollAwareDirection is enabled
    if (scrollAwareDirection && !isDragging.current) {
      if (velocityFactor.get() < 0) {
        directionFactor.current = -1
      } else if (velocityFactor.get() > 0) {
        directionFactor.current = 1
      }
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get()

    if (draggable) {
      moveBy += dragVelocity.current

      // Update direction based on drag direction if dragAwareDirection is true
      if (dragAwareDirection && Math.abs(dragVelocity.current) > 0.1) {
        directionFactor.current = Math.sign(dragVelocity.current)
      }

      // Gradually decay drag velocity back to zero
      if (!isDragging.current && Math.abs(dragVelocity.current) > 0.01) {
        dragVelocity.current *= dragVelocityDecay
      } else if (!isDragging.current) {
        dragVelocity.current = 0
      }
    }

    baseOffset.set(baseOffset.get() + moveBy)
  })

  // Owned here, so mutated here. The items report hover through these instead
  // of being handed the ref.
  const handleItemHoverStart = useCallback(() => {
    isHovered.current = true
  }, [])
  const handleItemHoverEnd = useCallback(() => {
    isHovered.current = false
  }, [])

  // Pointer event handlers for dragging
  const lastPointerPosition = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!draggable) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    if (grabCursor) {
      ;(e.currentTarget as HTMLElement).style.cursor = 'grabbing'
    }

    isDragging.current = true
    lastPointerPosition.current = { x: e.clientX, y: e.clientY }

    // Pause automatic animation by setting velocity to 0
    dragVelocity.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggable || !isDragging.current) return

    const currentPosition = { x: e.clientX, y: e.clientY }

    // Calculate movement delta - simplified for path movement
    const deltaX = currentPosition.x - lastPointerPosition.current.x
    const deltaY = currentPosition.y - lastPointerPosition.current.y

    // For path following, we use a simple magnitude of movement
    const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const projectedDelta = deltaX > 0 ? delta : -delta

    // Update drag velocity based on the projected movement
    dragVelocity.current = projectedDelta * dragSensitivity

    // Update last position
    lastPointerPosition.current = currentPosition
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggable) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    isDragging.current = false

    if (grabCursor) {
      ;(e.currentTarget as HTMLElement).style.cursor = 'grab'
    }
  }

  return (
    <div
      ref={container}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn('relative', className)}
    >
      <div
        ref={marqueeContainerRef}
        className="relative"
        style={{ contain: 'layout style' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={viewBox}
          preserveAspectRatio={preserveAspectRatio}
          className="h-full w-full"
        >
          <path
            id={id}
            d={path}
            stroke={showPath ? 'currentColor' : 'none'}
            fill="none"
            ref={pathRef}
          />
        </svg>

        {items.map(({ child, repeatIndex, itemIndex, key }) => (
          <MarqueeItem
            key={key}
            baseOffset={baseOffset}
            itemIndex={itemIndex}
            itemCount={items.length}
            repeatIndex={repeatIndex}
            path={path}
            easing={easing}
            calculateZIndex={calculateZIndex}
            enableRollingZIndex={enableRollingZIndex}
            cssVariableInterpolation={cssVariableInterpolation}
            draggable={draggable}
            grabCursor={grabCursor}
            onHoverStart={handleItemHoverStart}
            onHoverEnd={handleItemHoverEnd}
          >
            {child}
          </MarqueeItem>
        ))}
      </div>
    </div>
  )
}

/**
 * One item riding the path.
 *
 * This is the body of the original's `.map()` callback, lifted into a
 * component so its hooks run in a component rather than a loop. Nothing about
 * what it does changed.
 */
function MarqueeItem({
  children,
  baseOffset,
  itemIndex,
  itemCount,
  repeatIndex,
  path,
  easing,
  calculateZIndex,
  enableRollingZIndex,
  cssVariableInterpolation,
  draggable,
  grabCursor,
  onHoverStart,
  onHoverEnd,
}: {
  children: React.ReactNode
  baseOffset: MotionValue<number>
  itemIndex: number
  itemCount: number
  repeatIndex: number
  path: string
  easing?: (value: number) => number
  calculateZIndex: (offsetDistance: number) => number | undefined
  enableRollingZIndex: boolean
  cssVariableInterpolation: CSSVariableInterpolation[]
  draggable: boolean
  grabCursor: boolean
  // The hover flag belongs to the parent, so the parent mutates it. Handing
  // the ref down and writing to it from here mutates a value this component
  // does not own, which the React compiler rejects outright.
  onHoverStart: () => void
  onHoverEnd: () => void
}) {
  // Create a unique offset transform for each item
  const itemOffset = useTransform(baseOffset, (v) => {
    const position = (itemIndex * 100) / itemCount
    const wrappedValue = wrap(0, 100, v + position)
    return `${easing ? easing(wrappedValue / 100) * 100 : wrappedValue}%`
  })

  // Create a motion value for the current offset distance
  const currentOffsetDistance = useMotionValue(0)

  // Update z-index when offset distance changes
  const zIndex = useTransform(currentOffsetDistance, (value) => calculateZIndex(value))

  // Update current offset distance value when animation runs
  useEffect(() => {
    const unsubscribe = itemOffset.on('change', (value: string) => {
      // Parse percentage string to get numerical value
      const match = value.match(/^([\d.]+)%$/)
      if (match && match[1]) {
        currentOffsetDistance.set(parseFloat(match[1]))
      }
    })
    return unsubscribe
  }, [itemOffset, currentOffsetDistance])

  /**
   * The interpolated CSS variables, written straight to the node.
   *
   * The original builds one `useTransform` per entry inside a `.map()`, which
   * is a hook in a loop for the same reason the items were. Subscribing once
   * and calling `setProperty` gets the identical result - these are custom
   * properties, so nothing reads them through React anyway - and it works for
   * a list of any length.
   */
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cssVariableInterpolation.length === 0) return

    const apply = (distance: number) => {
      const node = elementRef.current
      if (!node) return
      const progress = distance / 100
      for (const { property, from, to } of cssVariableInterpolation) {
        if (typeof from === 'number' && typeof to === 'number') {
          node.style.setProperty(property, String(from + (to - from) * progress))
        } else {
          // A non-numeric pair cannot be interpolated, so it switches at the
          // midpoint rather than being dropped silently.
          node.style.setProperty(property, String(progress < 0.5 ? from : to))
        }
      }
    }

    apply(currentOffsetDistance.get())
    return currentOffsetDistance.on('change', apply)
  }, [cssVariableInterpolation, currentOffsetDistance])

  return (
    <motion.div
      ref={elementRef}
      className={cn('absolute top-0 left-0', draggable && grabCursor && 'cursor-grab')}
      style={{
        offsetPath: `path('${path}')`,
        offsetDistance: itemOffset,
        zIndex: enableRollingZIndex ? zIndex : undefined,
        willChange: 'offset-distance',
        backfaceVisibility: 'hidden',
      }}
      aria-hidden={repeatIndex > 0}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {children}
    </motion.div>
  )
}

export default MarqueeAlongSvgPath
