import type { NextConfig } from 'next'

/**
 * Court hero images are uploaded to Supabase Storage, so their host is the
 * project URL. next/image refuses to optimise a remote host that is not listed
 * here — without this entry, any court with a hero image throws at render and
 * takes the catalog down with it.
 */
function supabaseImageHost(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!url) {
    return []
  }

  try {
    const { protocol, hostname } = new URL(url)

    return [
      {
        protocol: protocol.replace(':', '') as 'http' | 'https',
        hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ]
  } catch {
    // env.ts fails the build on a malformed URL; this only has to not throw.
    return []
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImageHost(),
  },

  /**
   * Defence in depth for a site that renders club-supplied text and images.
   * A full CSP needs per-request nonces for Next's inline hydration scripts,
   * which is a larger change; these are the headers that carry their weight
   * without one.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The app frames nothing and should be framed by nothing.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Booking references must not ride along to third-party hosts.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
