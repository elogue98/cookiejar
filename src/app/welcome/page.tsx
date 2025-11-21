import Link from 'next/link'
import Navigation from '../components/Navigation'
import Logo from '../components/Logo'

export default function WelcomePage() {
  return (
    <div className="overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <Navigation />
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {/* Left Column - Content */}
          <div className="lg:pt-4 lg:pr-8">
            <div className="lg:max-w-lg">
              <h2 
                className="text-base/7 font-semibold"
                style={{ color: '#D34E4E' }}
              >
                Welcome to Cookie Jar
              </h2>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-pretty sm:text-5xl" style={{ color: 'var(--text-main)' }}>
                Your personal recipe manager
              </p>
              <p className="mt-6 text-lg/8" style={{ color: 'var(--text-main)' }}>
                Organize, discover, and enjoy your favorite recipes all in one place. Import from anywhere, scan from cookbooks, and build your perfect recipe collection.
              </p>

              <dl className="mt-10 max-w-xl space-y-8 text-base/7 lg:max-w-none" style={{ color: 'var(--text-main)' }}>
                <div className="relative pl-9">
                  <dt className="inline font-semibold" style={{ color: 'var(--text-main)' }}>
                    <svg 
                      className="absolute top-1 left-1 size-5" 
                      style={{ color: '#D34E4E' }}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth="1.5" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    Import from any URL.
                  </dt>
                  <dd className="inline"> Paste a recipe link and we'll extract all the details automatically.</dd>
                </div>

                <div className="relative pl-9">
                  <dt className="inline font-semibold" style={{ color: 'var(--text-main)' }}>
                    <svg 
                      className="absolute top-1 left-1 size-5" 
                      style={{ color: '#D34E4E' }}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth="1.5" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    Scan photos of cookbooks.
                  </dt>
                  <dd className="inline"> Take a picture of handwritten notes or cookbook pages and we'll digitize them.</dd>
                </div>

                <div className="relative pl-9">
                  <dt className="inline font-semibold" style={{ color: 'var(--text-main)' }}>
                    <svg 
                      className="absolute top-1 left-1 size-5" 
                      style={{ color: '#D34E4E' }}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      strokeWidth="1.5" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                    Fully organized & searchable.
                  </dt>
                  <dd className="inline"> Auto-organized ingredients, instructions, ratings, and tags make finding recipes effortless.</dd>
                </div>
              </dl>

              <div className="mt-10">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-base font-semibold transition-colors hover:opacity-90"
                  style={{ 
                    background: '#D34E4E', 
                    color: 'white',
                  }}
                >
                  Get Started
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column - Logo/Image */}
          <div className="flex items-center justify-center lg:justify-end">
            <div 
              className="w-full max-w-3xl rounded-xl shadow-xl border p-8 flex items-center justify-center"
              style={{ 
                background: '#F9E7B2',
                borderColor: 'rgba(221, 197, 122, 0.3)'
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <Logo size={120} />
                <h3 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                  Cookie Jar
                </h3>
                <p className="text-center text-sm" style={{ color: 'var(--text-main)', opacity: 0.7 }}>
                  Your recipe collection, beautifully organized
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

