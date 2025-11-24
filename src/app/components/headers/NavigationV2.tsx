'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/app/components/Logo'
import { useUser } from '@/lib/userContext'

export default function NavigationV2() {
  const router = useRouter()
  const { user, logoutUser } = useUser()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false)
      }
    }

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userDropdownOpen])

  const handleLogout = () => {
    logoutUser()
    setUserDropdownOpen(false)
    router.push('/login')
  }

  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
      <nav className="flex items-center gap-2 p-2 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-lg shadow-slate-200/50 max-w-3xl w-full justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pl-2 pr-4 group">
          <div className="transition-transform group-hover:scale-110 duration-300">
            <Logo size={32} />
          </div>
          <span className="font-bold text-slate-900 hidden sm:block">Cookie Jar</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
          >
            Recipes
          </Link>
          <Link
            href="/welcome"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
          >
            About
          </Link>
        </div>

        {/* User Actions */}
        <div className="flex items-center pl-2 pr-1">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none pl-2 pr-1 py-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.name}</span>
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-slate-200"
                />
              </button>
              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-4 w-48 rounded-2xl shadow-xl border border-slate-100 bg-white z-50 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                >
                  <Link
                    href="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    View Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-semibold text-white bg-[#D34E4E] hover:bg-[#b93c3c] rounded-full transition-colors shadow-sm shadow-red-200"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}

