'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

const USER_STORAGE_KEY = 'cookiejar_user'

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setUserState(parsed)
      }
    } catch (error) {
      console.error('Error loading user from storage:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save user to localStorage whenever it changes
  const setUser = (newUser: User | null) => {
    setUserState(newUser)
    if (newUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  }

  const logoutUser = () => {
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, setUser, logoutUser, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Helper functions for server/client compatibility
export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

