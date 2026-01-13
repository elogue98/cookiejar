'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Logo from '@/app/components/Logo'
import { useUser } from '@/lib/userContext'

export default function Navigation({ forceTheme }: { forceTheme?: string }) {
  const router = useRouter()
  const { user, logoutUser } = useUser()
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (forceTheme && theme !== forceTheme) {
      setTheme(forceTheme)
    }
  }, [forceTheme, theme, setTheme])

  const currentTheme = forceTheme || theme
  const isTipJar = currentTheme === 'tipjar'

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const toggleTheme = () => {
    setMobileMenuOpen(false)
    if (isTipJar) {
      setTheme('cookie')
      router.push('/')
    } else {
      setTheme('tipjar')
      router.push('/places')
    }
  }

  // Different header styles for each mode
  const headerStyle = mounted && isTipJar
    ? {
        background: 'linear-gradient(135deg, #1E3A5F 0%, #0C1222 100%)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
      }
    : {
        backgroundColor: '#F9E7B2',
        borderBottom: '1px solid rgba(211, 78, 78, 0.1)',
      }

  return (
    <header
      className="shadow-sm sticky top-0 z-50 transition-all duration-300"
      style={headerStyle}
    >
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
        
        {/* Left: Logo */}
        <div className="flex flex-shrink-0">
          <Link
            href={isTipJar ? '/places' : '/'}
            className="-m-1.5 p-1.5 flex items-center gap-3 group"
          >
            <div className="transform transition-transform duration-300 group-hover:rotate-12">
              {mounted && isTipJar ? (
                <Image
                  src="/tipjar.png"
                  alt="Tip Jar"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <Logo size={40} />
              )}
            </div>
            <span 
              className="text-xl font-bold transition-all duration-300"
              style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
            >
              {isTipJar ? 'Tip Jar' : 'Cookie Jar'}
            </span>
          </Link>
        </div>

        {/* Right: Links & User */}
        <div className="flex items-center gap-8">
          <div className="hidden lg:flex lg:gap-x-8 items-center">
            {['Recipes', 'About'].map((item) => (
              <Link
                key={item}
                href={item === 'About' ? '/welcome' : '/'}
                className="relative text-sm font-semibold transition-colors group"
                style={{ color: isTipJar ? '#94A3B8' : '#334155' }}
              >
                {item}
                <span 
                  className="absolute inset-x-0 bottom-[-4px] h-0.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left"
                  style={{ backgroundColor: isTipJar ? '#3B82F6' : '#D34E4E' }}
                ></span>
              </Link>
            ))}
            
            {/* Mode Toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 hover:opacity-90"
                style={{
                  backgroundColor: isTipJar ? '#3B82F6' : '#D34E4E',
                  color: 'white',
                }}
              >
                {isTipJar ? 'Cookie Jar' : 'Tip Jar'}
              </button>
            )}
          </div>

          <div 
            className="hidden lg:block w-px h-6 mx-2"
            style={{ backgroundColor: isTipJar ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0,0,0,0.1)' }}
          ></div>

          <div className="hidden lg:flex items-center">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-3 focus:outline-none group p-1 pr-3 rounded-full transition-colors"
                  style={{ 
                    backgroundColor: userDropdownOpen 
                      ? (isTipJar ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.05)')
                      : 'transparent',
                  }}
                >
                  <Image
                    src={user.avatar_url}
                    alt={user.name}
                    width={36}
                    height={36}
                    sizes="36px"
                    className="w-9 h-9 rounded-full border-2 shadow-sm transition-colors object-cover"
                    style={{ borderColor: isTipJar ? '#1E3A5F' : '#FFFFFF' }}
                  />
                  <div className="text-left">
                    <p 
                      className="text-sm font-semibold transition-colors"
                      style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                    >
                      {user.name}
                    </p>
                  </div>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-300 ${userDropdownOpen ? 'rotate-180' : ''}`} 
                    style={{ color: isTipJar ? '#94A3B8' : '#6B7280' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ 
                      backgroundColor: isTipJar ? '#162032' : '#FFFFFF',
                      border: `1px solid ${isTipJar ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  >
                    <div 
                      className="px-4 py-2 border-b mb-1" 
                      style={{ borderColor: isTipJar ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.05)' }}
                    >
                      <p 
                        className="text-xs font-medium uppercase tracking-wider" 
                        style={{ color: isTipJar ? '#94A3B8' : '#6B7280' }}
                      >
                        Account
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                      style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
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
                className="relative px-6 py-2.5 text-sm font-semibold text-white rounded-full overflow-hidden group shadow-lg transition-all"
                style={{ backgroundColor: isTipJar ? '#3B82F6' : '#D34E4E' }}
              >
                <span className="relative z-10">Log in</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 transition-colors"
              style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
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
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div 
            className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto p-6 sm:max-w-sm shadow-2xl transform transition-transform duration-300"
            style={{ 
              background: isTipJar 
                ? 'linear-gradient(135deg, #1E3A5F 0%, #0C1222 100%)'
                : '#F9E7B2'
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <Link
                href={isTipJar ? '/places' : '/'}
                className="-m-1.5 p-1.5 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {mounted && isTipJar ? (
                  <Image
                    src="/tipjar.png"
                    alt="Tip Jar"
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <Logo size={32} />
                )}
                <span 
                  className="text-xl font-bold" 
                  style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                >
                  {isTipJar ? 'Tip Jar' : 'Cookie Jar'}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5"
                style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
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
              <div className="-my-6 divide-y" style={{ borderColor: isTipJar ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.1)' }}>
                <div className="space-y-2 py-6">
                  {mounted && (
                    <button
                      onClick={toggleTheme}
                      className="w-full text-left -mx-3 block rounded-xl px-4 py-3 text-base font-semibold transition-colors"
                      style={{ color: isTipJar ? '#3B82F6' : '#D34E4E' }}
                    >
                      Switch to {isTipJar ? 'Cookie Jar' : 'Tip Jar'}
                    </button>
                  )}
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold transition-colors"
                    style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                  >
                    Recipes
                  </Link>
                  <Link
                    href="/welcome"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold transition-colors"
                    style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                  >
                    About
                  </Link>
                </div>
                <div className="py-6">
                  {user ? (
                    <div className="space-y-3">
                      <div 
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ backgroundColor: isTipJar ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.5)' }}
                      >
                        <Image
                          src={user.avatar_url}
                          alt={user.name}
                          width={40}
                          height={40}
                          sizes="40px"
                          className="w-10 h-10 rounded-full border-2 object-cover"
                          style={{ borderColor: isTipJar ? '#1E3A5F' : '#FFFFFF' }}
                        />
                        <div>
                          <p 
                            className="text-sm font-semibold" 
                            style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                          >
                            {user.name}
                          </p>
                          <p 
                            className="text-xs" 
                            style={{ color: isTipJar ? '#94A3B8' : '#6B7280' }}
                          >
                            Logged in
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="-mx-3 block rounded-xl px-4 py-3 text-base font-semibold transition-colors"
                        style={{ color: isTipJar ? '#F1F5F9' : '#2B2B2B' }}
                      >
                        View Profile
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout()
                          setMobileMenuOpen(false)
                        }}
                        className="-mx-3 block w-full text-left rounded-xl px-4 py-3 text-base font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-bold text-white transition-colors shadow-lg"
                      style={{ backgroundColor: isTipJar ? '#3B82F6' : '#D34E4E' }}
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
