'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/userContext'
import Logo from '../components/Logo'
import { supabase } from '@/lib/supabaseClient'

interface User {
  id: string
  name: string
  avatar_url: string
}

export default function LoginPage() {
  const router = useRouter()
  const { user, setUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  // Fetch users from Supabase
  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('name')

        if (error) {
          // Only log if it's not a "relation does not exist" error (table doesn't exist yet)
          if (error.code !== '42P01' && error.message !== 'relation "public.users" does not exist') {
            console.error('Error fetching users:', error)
          }
          // Fallback to hardcoded users if table doesn't exist yet (using UUIDs that match migration)
          setUsers([
            { id: '00000000-0000-0000-0000-000000000001', name: 'Eoin', avatar_url: '/Users/Eoin.png' },
            { id: '00000000-0000-0000-0000-000000000002', name: 'Katie', avatar_url: '/Users/Katie.png' },
            { id: '00000000-0000-0000-0000-000000000003', name: 'Conor', avatar_url: '/Users/Conor.png' },
          ])
        } else if (data && data.length > 0) {
          setUsers(data)
        } else {
          // Fallback if no users in database (using UUIDs that match migration)
          setUsers([
            { id: '00000000-0000-0000-0000-000000000001', name: 'Eoin', avatar_url: '/Users/Eoin.png' },
            { id: '00000000-0000-0000-0000-000000000002', name: 'Katie', avatar_url: '/Users/Katie.png' },
            { id: '00000000-0000-0000-0000-000000000003', name: 'Conor', avatar_url: '/Users/Conor.png' },
          ])
        }
      } catch (error) {
        // Only log unexpected errors
        if (error instanceof Error && !error.message.includes('does not exist')) {
          console.error('Error fetching users:', error)
        }
        // Fallback to hardcoded users (using UUIDs that match migration)
        setUsers([
          { id: '00000000-0000-0000-0000-000000000001', name: 'Eoin', avatar_url: '/Users/Eoin.png' },
          { id: '00000000-0000-0000-0000-000000000002', name: 'Katie', avatar_url: '/Users/Katie.png' },
          { id: '00000000-0000-0000-0000-000000000003', name: 'Conor', avatar_url: '/Users/Conor.png' },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const handleUserSelect = (selectedUser: User) => {
    setUser(selectedUser)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F9E7B2' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D34E4E] mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-main)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F9E7B2' }}>
      {/* Header with Logo */}
      <header className="flex justify-end p-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Cookie Jar</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
            Choose Your Profile
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-main)', opacity: 0.7 }}>
            Select your avatar to get started
          </p>
        </div>

        {/* User Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className="group relative flex flex-col items-center p-6 rounded-[14px] transition-all duration-300 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#D34E4E] focus:ring-offset-2"
              style={{
                background: 'white',
                borderRadius: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* Avatar */}
              <div
                className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{
                  border: '3px solid #DDC57A',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <Image
                  src={user.avatar_url}
                  alt={user.name}
                  fill
                  sizes="(min-width: 768px) 160px, 128px"
                  className="object-cover"
                />
              </div>

              {/* Name */}
              <h3
                className="text-xl font-semibold transition-colors duration-300"
                style={{ color: 'var(--text-main)' }}
              >
                {user.name}
              </h3>

              {/* Hover indicator */}
              <div
                className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ background: '#D34E4E' }}
              />
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
