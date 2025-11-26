'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/userContext'
import Navigation from '../components/Navigation'

export default function ProfilePage() {
  const router = useRouter()
  const { user, isLoading } = useUser()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D34E4E] mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-main)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-lg border p-8" style={{ 
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          borderColor: 'rgba(211, 78, 78, 0.1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div className="flex flex-col items-center text-center">
            <div
              className="w-32 h-32 rounded-full overflow-hidden mb-6"
              style={{
                border: '3px solid #DDC57A',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Image
                src={user.avatar_url}
                alt={user.name}
                width={128}
                height={128}
                sizes="128px"
                className="w-full h-full object-cover"
              />
            </div>
            
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
              {user.name}
            </h1>
            
            <p className="text-sm mb-8" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
              Your Cookie Jar profile
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
