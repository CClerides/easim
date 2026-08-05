/**
 * A fixed-window rate limiter, held in this process's memory.
 *
 * Be honest about what this is: a speed bump, not a guarantee. Each serverless
 * instance keeps its own counter, so a determined attacker spread across
 * instances gets more attempts than the number here suggests. It stops the
 * accidental double-click and the casual script, which is most of the value.
 *
 * The real answer is a shared store — Upstash Redis on Vercel — and that is
 * named in the README as a next step rather than pretended away. It is not
 * here because it is a paid service and this build is free-tier only.
 */

type Options = {
  limit: number
  windowMs: number
}

type Result = {
  allowed: boolean
  retryAfterSeconds: number
}

type Window = {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function checkRateLimit(key: string, options: Options, now = Date.now()): Result {
  const existing = windows.get(key)

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count < options.limit) {
    existing.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  }
}

/** Test helper. Nothing in the application clears these. */
export function resetRateLimits(): void {
  windows.clear()
}
