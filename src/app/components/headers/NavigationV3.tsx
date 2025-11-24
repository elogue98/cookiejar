'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/app/components/Logo'
import { useUser } from '@/lib/userContext'

export default function NavigationV3() {
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
    <header className="bg-white shadow-sm sticky top-0 z-50 transition-all duration-300">
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        
        {/* Left: Logo */}
        <div className="flex flex-shrink-0">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-3 group">
            <div className="transform transition-transform duration-300 group-hover:rotate-12">
              <Logo size={40} />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent group-hover:to-[#D34E4E] transition-all duration-300">
              Cookie Jar
            </span>
          </Link>
        </div>

        {/* Right: Links & User */}
        <div className="flex items-center gap-8">
          <div className="hidden lg:flex lg:gap-x-8">
            {['Recipes', 'About'].map((item) => (
              <Link
                key={item}
                href={item === 'About' ? '/welcome' : '/'}
                className="relative text-sm font-semibold text-slate-700 transition-colors hover:text-[#D34E4E] group"
              >
                {item}
                <span className="absolute inset-x-0 bottom-[-4px] h-0.5 bg-[#D34E4E] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left"></span>
              </Link>
            ))}
          </div>

          <div className="hidden lg:block w-px h-6 bg-slate-200 mx-2"></div>

          <div className="hidden lg:flex items-center">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-3 focus:outline-none group p-1 pr-3 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                >
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-9 h-9 rounded-full border-2 border-white shadow-sm group-hover:border-[#D34E4E] transition-colors"
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-[#D34E4E] transition-colors">
                      {user.name}
                    </p>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${userDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl bg-white z-50 py-2 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Account</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#D34E4E] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="relative px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full overflow-hidden group shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all"
              >
                <span className="relative z-10 group-hover:text-white transition-colors">Log in</span>
                <div className="absolute inset-0 bg-[#D34E4E] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-700 hover:bg-slate-100 transition-colors"
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
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white p-6 sm:max-w-sm shadow-2xl transform transition-transform duration-300">
            <div className="flex items-center justify-between mb-8">
              <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Logo size={32} />
                <span className="text-xl font-bold text-slate-900">Cookie Jar</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5 text-slate-700 hover:bg-slate-100"
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
            <div className="flow-root">
              <div className="-my-6 divide-y divide-slate-100">
                <div className="space-y-2 py-6">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 hover:text-[#D34E4E] transition-colors"
                  >
                    Recipes
                  </Link>
                  <Link
                    href="/welcome"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 hover:text-[#D34E4E] transition-colors"
                  >
                    About
                  </Link>
                </div>
                <div className="py-6">
                  {user ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-10 h-10 rounded-full border-2 border-white"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">Logged in</p>
                        </div>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        View Profile
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout()
                          setMobileMenuOpen(false)
                        }}
                        className="-mx-3 block w-full text-left rounded-xl px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center justify-center rounded-xl bg-[#D34E4E] px-4 py-3 text-base font-bold text-white hover:bg-[#b93c3c] transition-colors shadow-lg shadow-red-200"
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

