import { describe, expect, it } from 'vitest'

import { getSecurityHeaders } from './securityHeaders'

describe('security headers', () => {
  it('includes the required production protections and CSP allowlists', () => {
    const headers = Object.fromEntries(getSecurityHeaders(false).map((header) => [header.key, header.value]))

    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Content-Security-Policy']).toContain("https://*.supabase.co")
    expect(headers['Content-Security-Policy']).toContain('https://maps.googleapis.com')
    expect(headers['Content-Security-Policy']).toContain('https://va.vercel-scripts.com')
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  })
})
