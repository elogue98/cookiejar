import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#E2B59A] text-[#6B563F]">
      <header className="border-b border-[#B77466]/30 bg-[#E2B59A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-3xl font-bold text-[#6B563F] hover:text-[#6B563F]/80 transition-colors cursor-pointer">
            🍪 CookieJar
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#7A634F] rounded-lg border border-[#B77466]/30 p-8 text-center">
          <h2 className="text-2xl font-bold text-[#FFE1AF] mb-4">
            Recipe not found
          </h2>
          <p className="text-[#FFE1AF]/90 mb-6">
            The recipe you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[#B77466] hover:bg-[#A86558] text-[#FFE1AF] font-medium rounded-lg transition-colors border border-[#B77466]/50"
          >
            ← Back to Recipes
          </Link>
        </div>
      </main>
    </div>
  )
}

