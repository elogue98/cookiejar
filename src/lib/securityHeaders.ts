export type SecurityHeader = { key: string; value: string }

export function getSecurityHeaders(isDevelopment = process.env.NODE_ENV !== 'production'): SecurityHeader[] {
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com https://maps.googleapis.com https://maps.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://maps.googleapis.com https://*.googleapis.com https://*.vercel-insights.com https://vitals.vercel-insights.com",
    "frame-src 'self' https://www.google.com https://maps.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ')

  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ...(isDevelopment
      ? []
      : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
  ]
}
