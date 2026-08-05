import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The mock provider is a workspace package of raw TypeScript with no build
  // step of its own, so Next compiles it alongside the app.
  transpilePackages: ['@trezuz/mock-provider'],
}

export default nextConfig
