'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import Logo from '../components/Logo'
import { supabase } from '@/lib/supabase/browser'
import { useUser } from '@/lib/userContext'

export default function LoginPage() {
  const router = useRouter()
  const { user } = useUser()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const authError = new URLSearchParams(window.location.search).get('error')
    if (authError === 'not-linked') return 'This email is not linked to a family profile.'
    if (authError === 'invalid-link') return 'That sign-in link is invalid or expired.'
    if (authError === 'auth-error') return 'We could not verify that sign-in link.'
    return null
  })

  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
      },
    })

    if (signInError) {
      setError('We could not send a sign-in link. Check the email and try again.')
    } else {
      setMessage('Check your email for a secure sign-in link.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: '#F9E7B2' }}>
      <header className="flex justify-end p-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Cookie Jar</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl" style={{ color: 'var(--text-main)' }}>
            Welcome back
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-main)', opacity: 0.7 }}>
            Sign in with your invited family email
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto max-w-md rounded-[14px] bg-white p-6 shadow-lg">
          <label htmlFor="email" className="mb-2 block font-semibold" style={{ color: 'var(--text-main)' }}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-4 w-full rounded border px-3 py-2"
          />
          {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="mb-4 text-sm text-green-700">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[#D34E4E] px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Sending link…' : 'Email me a sign-in link'}
          </button>
        </form>
      </main>
    </div>
  )
}
