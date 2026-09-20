'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase/browser'
import { createUserSession } from './userSession'

export interface User {
  id: string
  name: string
  avatar_url: string
}

interface UserContextType {
  user: User | null
  setUser: (user: User | null) => void
  logoutUser: () => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const sessionRef = useRef<ReturnType<typeof createUserSession> | null>(null)

  useEffect(() => {
    const session = createUserSession({
      fetchProfile: signal => fetch('/api/auth/profile', { cache: 'no-store', signal }),
      update: state => {
        setUserState(state.user)
        setIsLoading(state.isLoading)
      },
      unauthorized: () => {
        if (window.location.pathname !== '/login') window.location.replace('/login')
      },
    })
    sessionRef.current = session
    // INITIAL_SESSION supplies the first identity; no duplicate getClaims request.
    const { data: authState } = supabase.auth.onAuthStateChange((event, authSession) => {
      session.handle(event, authSession?.user.id ?? null)
    })

    return () => {
      authState.subscription.unsubscribe()
      session.dispose()
      sessionRef.current = null
    }
  }, [])

  const setUser = (newUser: User | null) => {
    setUserState(newUser)
  }

  const logoutUser = () => {
    sessionRef.current?.clear()
    setUserState(null)
    void fetch('/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(() => undefined)
      .finally(() => {
        void supabase.auth.signOut({ scope: 'local' })
      })
  }

  return (
    <UserContext.Provider value={{ user, setUser, logoutUser, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}

/** @deprecated Use useUser() inside a client component. */
export function getUser(): User | null {
  return null
}
