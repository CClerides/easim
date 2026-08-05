import type { NextConfig } from 'next'
import { securityHeaders } from './src/lib/security/headers'

const nextConfig: NextConfig = {
  // The mock provider is a workspace package of raw TypeScript with no build
  // step of its own, so Next compiles it alongside the app.
  transpilePackages: ['@trezuz/mock-provider'],

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders() }]
  },
}

export default nextConfig
