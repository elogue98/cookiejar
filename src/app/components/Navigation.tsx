'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from './Logo'
import { useUser } from '@/lib/userContext'

export default function Navigation() {
  const router = useRouter()
  const { user, logoutUser } = useUser()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
    <header className="bg-[#F9E7B2]" style={{ borderBottom: '1px solid rgba(211, 78, 78, 0.1)' }}>
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        <div className="flex">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-3">
            <span className="sr-only">Cookie Jar</span>
            <Logo size={40} />
            <span className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Cookie Jar</span>
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5"
            style={{ color: 'var(--text-main)' }}
          >
            <span className="sr-only">Open main menu</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
              className="size-6"
            >
              <path
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-x-12">
          <Link
            href="/welcome"
            className="text-sm/6 font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--text-main)' }}
          >
            About
          </Link>
          <Link
            href="/"
            className="text-sm/6 font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--text-main)' }}
          >
            Recipes
          </Link>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#D34E4E] focus:ring-offset-2 rounded-full"
                style={{ borderRadius: '14px' }}
              >
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-10 h-10 rounded-full border-2 border-[#DDC57A]"
                  style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                />
                <span className="text-sm/6 font-semibold" style={{ color: 'var(--text-main)' }}>
                  {user.name}
                </span>
              </button>
              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-[14px] shadow-lg z-50"
                  style={{
                    background: 'white',
                    border: '1px solid rgba(211, 78, 78, 0.1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="block px-4 py-2 text-sm transition-colors hover:bg-[#F9E7B2]"
                      style={{ color: 'var(--text-main)' }}
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#F9E7B2]"
                      style={{ color: 'var(--text-main)' }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm/6 font-semibold transition-colors hover:opacity-90"
              style={{ color: 'var(--text-main)' }}
            >
              Log in <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      </nav>
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                <span className="sr-only">Cookie Jar</span>
                <Logo size={40} />
                <span className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Cookie Jar</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5"
                style={{ color: 'var(--text-main)' }}
              >
                <span className="sr-only">Close menu</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className="size-6"
                >
                  <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  <Link
                    href="/welcome"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold hover:bg-gray-50"
                    style={{ color: 'var(--text-main)' }}
                  >
                    About
                  </Link>
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold hover:bg-gray-50"
                    style={{ color: 'var(--text-main)' }}
                  >
                    Recipes
                  </Link>
                </div>
                <div className="py-6">
                  {user ? (
                    <>
                      <div className="-mx-3 px-3 py-2 flex items-center gap-3">
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-10 h-10 rounded-full border-2 border-[#DDC57A]"
                        />
                        <span className="text-base/7 font-semibold" style={{ color: 'var(--text-main)' }}>
                          {user.name}
                        </span>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold hover:bg-gray-50"
                        style={{ color: 'var(--text-main)' }}
                      >
                        View Profile
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout()
                          setMobileMenuOpen(false)
                        }}
                        className="-mx-3 block w-full text-left rounded-lg px-3 py-2.5 text-base/7 font-semibold hover:bg-gray-50"
                        style={{ color: 'var(--text-main)' }}
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold hover:bg-gray-50"
                      style={{ color: 'var(--text-main)' }}
                    >
                      Log in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

