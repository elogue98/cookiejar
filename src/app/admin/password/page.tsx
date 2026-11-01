import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminLoginConfig } from '@/lib/adminLogin'
import { requireFamilyPage } from '@/lib/serverPageAuth'
import PasswordForm from '../PasswordForm'

export const metadata: Metadata = { title: 'Set password | Cookie Jar', robots: { index: false, follow: false } }

export default async function AdminPasswordPage() {
  const profile = await requireFamilyPage()
  let config
  try {
    config = getAdminLoginConfig()
  } catch {
    return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-bold">Password entrance is not configured yet</h1><p className="mt-4">Configure the account on the server before setting a password.</p><Link href="/" className="mt-4 block underline">Back to Cookie Jar</Link></main>
  }
  if (profile.profileId !== config.profileId) redirect('/')
  return <PasswordForm setup />
}
