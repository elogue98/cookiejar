import type { Metadata } from 'next'
import PasswordForm from '../PasswordForm'

export const metadata: Metadata = { title: 'Private entrance | Cookie Jar', robots: { index: false, follow: false } }

export default function AdminLoginPage() {
  return <PasswordForm />
}
