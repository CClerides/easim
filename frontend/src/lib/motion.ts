/**
 * Motion tokens.
 *
 * Every animation in this app uses a spring from this file rather than a
 * hand-picked duration and curve. The reason is not consistency for its own
 * sake: a fixed-duration curve cannot be interrupted gracefully, because it
 * interpolates from where it was told to start rather than from where the
 * element actually is on screen. A spring always animates from the current
 * value, so a thing you grab mid-flight follows you instead of jumping.
 *
 * Apple describes springs with two designer-facing numbers instead of the
 * physics triplet:
 *
 *   damping ratio - how much it overshoots. 1.0 settles with no bounce.
 *   response      - how quickly it reaches the target, in seconds. Not a
 *                   duration; a spring has no fixed end.
 *
 * Motion's `bounce` and `duration` map onto those, which is what the values
 * below are doing.
 *
 * The rule that decides which one to use: **bounce is earned by momentum.**
 * Overshoot on a panel that simply appeared looks like a bug. Overshoot on
 * something the user threw looks like physics. Nothing in this app is thrown,
 * so almost everything here is critically damped.
 */

/** Default for anything appearing, moving or settling. No overshoot. */
export const spring = {
  type: 'spring',
  bounce: 0,
  duration: 0.4,
} as const

/** Snappier, for small immediate feedback like a badge changing state. */
export const springQuick = {
  type: 'spring',
  bounce: 0,
  duration: 0.28,
} as const

/**
 * The one place a little overshoot is justified: an order reaching `fulfilled`.
 * It is the moment the customer has been waiting for, and a spring that
 * arrives with a slight settle reads as arrival rather than as a value
 * changing in a table.
 */
export const springArrival = {
  type: 'spring',
  bounce: 0.22,
  duration: 0.45,
} as const
