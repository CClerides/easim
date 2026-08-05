/**
 * Stands in for the `server-only` package under Vitest.
 *
 * That package deliberately throws when resolved outside a server bundle,
 * which is exactly what we want from the Next.js bundler and exactly what we
 * do not want from a test runner. Aliasing it here keeps the real guard in
 * place for the build while letting server modules be unit tested directly.
 */
export {}
