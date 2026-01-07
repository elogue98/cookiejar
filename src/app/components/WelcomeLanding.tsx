'use client'

import Link from 'next/link'
import { useState } from 'react'
import Navigation from '@/app/components/Navigation'
import ImportRecipeModal from '@/app/components/ImportRecipeModal'

export default function WelcomeLanding() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <Navigation forceTheme="cookie" />

      <ImportRecipeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              The New Standard
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]">
              Your recipes, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D34E4E] to-[#ff8f8f]">
                finally organized.
              </span>
            </h1>

            <p className="text-xl text-slate-600 mb-10 max-w-lg leading-relaxed">
              Import from any website, scan your physical cookbooks, and build a personal database that&apos;s actually searchable.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[#D34E4E] rounded-xl shadow-lg shadow-red-200 hover:bg-[#b93c3c] hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                Start Cooking
              </Link>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Try Import
              </button>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 border-t border-slate-100 pt-8">
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">100%</div>
                <div className="text-sm text-slate-500 font-medium">Ad-Free</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">AI</div>
                <div className="text-sm text-slate-500 font-medium">Powered</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 mb-1">Any</div>
                <div className="text-sm text-slate-500 font-medium">Device</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-amber-100 to-red-50 rounded-[3rem] opacity-50 blur-3xl -z-10"></div>

            <div className="grid gap-6 relative">
              <div className="transform translate-y-4 lg:translate-x-8">
                <div className="group bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-start gap-4 transition-all duration-500 hover:bg-red-50/30 hover:-translate-y-2 hover:shadow-2xl hover:border-[#D34E4E]/50 cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-[#D34E4E] shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-[#D34E4E] transition-colors">Instant Import</h3>
                    <p className="text-sm text-slate-500 mt-1 group-hover:text-slate-600 transition-colors">Paste a URL, get a recipe. No life stories, just food.</p>
                  </div>
                </div>
              </div>

              <div className="lg:-translate-x-4 z-10">
                <div className="group bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-start gap-4 transition-all duration-500 hover:bg-amber-50/50 hover:-translate-y-2 hover:shadow-2xl hover:border-amber-500/50 cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">Scan &amp; Digitize</h3>
                    <p className="text-sm text-slate-500 mt-1 group-hover:text-slate-600 transition-colors">Turn old cookbooks into searchable digital recipes.</p>
                  </div>
                </div>
              </div>

              <div className="transform -translate-y-2 lg:translate-x-8">
                <div className="group bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-start gap-4 transition-all duration-500 hover:bg-emerald-50/50 hover:-translate-y-2 hover:shadow-2xl hover:border-emerald-500/50 cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Meal Planning</h3>
                    <p className="text-sm text-slate-500 mt-1 group-hover:text-slate-600 transition-colors">Organize your week with a drag-and-drop calendar.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

