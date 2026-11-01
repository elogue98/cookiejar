import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('keeps passwords in POST bodies when JavaScript has not hydrated', () => {
  const source = readFileSync(new URL('./PasswordForm.tsx', import.meta.url), 'utf8')
  const form = source.match(/<form\b[^>]+>/)?.[0]
  expect(form).toContain('method="post"')
  expect(form).toContain("action={setup ? '/api/auth/admin-password' : '/auth/admin/login'}")
})
