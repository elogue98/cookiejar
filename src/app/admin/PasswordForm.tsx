'use client'

import { useState, type FormEvent } from 'react'
import Logo from '../components/Logo'

export default function PasswordForm({ setup = false }: { setup?: boolean }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (setup && password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(setup ? '/api/auth/admin-password' : '/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Please try again.')
      setPassword('')
      setConfirmation('')
      if (setup) setSaved(true)
      else window.location.replace('/')
    } catch (error) {
      setError(error instanceof Error && !(error instanceof TypeError) ? error.message : 'Could not connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#F9E7B2', color: 'var(--text-main)' }}>
      <header className="flex justify-end p-6">
        <div className="flex items-center gap-3"><Logo size={40} /><span className="text-2xl font-bold">Cookie Jar</span></div>
      </header>
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-4 text-center text-4xl font-bold">{setup ? 'Set your password' : 'Welcome back'}</h1>
        <p className="mb-8 text-center opacity-70">{setup ? 'Choose a password for your private entrance.' : 'Enter your password to open Cookie Jar.'}</p>
        <form method="post" action={setup ? '/api/auth/admin-password' : '/auth/admin/login'} onSubmit={submit} className="rounded-[14px] bg-white p-6 shadow-lg" aria-busy={loading}>
          {saved ? (
            <p role="status">Password saved. Next time, open <a href="/admin/login" className="underline">the private entrance</a> and enter your password.</p>
          ) : (
            <>
              <label htmlFor="password" className="mb-2 block font-semibold">{setup ? 'New password' : 'Password'}</label>
              <input id="password" name="password" type="password" required minLength={setup ? 12 : 1} maxLength={1024} autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} disabled={loading} aria-describedby={error ? 'password-error' : setup ? 'password-help' : undefined} className="mb-4 w-full rounded border px-3 py-2" />
              {setup && <>
                <p id="password-help" className="mb-4 text-sm opacity-70">Use at least 12 characters.</p>
                <label htmlFor="confirmation" className="mb-2 block font-semibold">Confirm password</label>
                <input id="confirmation" name="confirmation" type="password" required minLength={12} maxLength={1024} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={loading} className="mb-4 w-full rounded border px-3 py-2" />
              </>}
              {error && <p id="password-error" role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded bg-[#D34E4E] px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? (setup ? 'Saving…' : 'Signing in…') : (setup ? 'Save password' : 'Open Cookie Jar')}</button>
            </>
          )}
        </form>
        <a href={setup ? '/' : '/login'} className="mt-6 block text-center text-sm underline">{setup ? 'Back to Cookie Jar' : 'Sign in by email instead'}</a>
      </main>
    </div>
  )
}
