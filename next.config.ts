import type { NextConfig } from "next"
import { getSecurityHeaders } from './src/lib/securityHeaders'

const supabaseHostname = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null
  try {
    return new URL(supabaseUrl).hostname
  } catch {
    return null
  }
})()

const isDevelopment = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHostname,
              pathname: '/storage/v1/object/sign/recipe-images/**',
            },
          ]
        : []),
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeaders(isDevelopment),
      },
    ]
  },
}

export default nextConfig
