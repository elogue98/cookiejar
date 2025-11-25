'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const messages = [
  // Data Extraction / Scraping
  "Extracting delicious secrets…",
  "Untangling spaghetti code from the website…",
  "Negotiating with stubborn HTML tags…",
  "Locating the \"print recipe\" button in the wild…",
  "Politely asking the website for its ingredients…",
  "Whispering sweet nothings to the metadata…",
  "Scooping out instructions one paragraph at a time…",
  "Removing pop-ups so you don't have to…",
  "Fetching the good bits, ignoring the drama…",
  "Climbing through the webpage's pantry…",
  "Scraping gently so we don't bruise the recipe…",
  "Borrowing ingredients without getting caught…",
  "Copying flavour molecules… almost done…",
  "Reading the small print (so you don't)…",
  "Debugging overly enthusiastic food bloggers…",
  
  // OCR / Image Import
  "Converting pixels to snacks…",
  "Teaching the AI to read messy handwriting…",
  "Asking the camera nicely for more clarity…",
  "Identifying flour smudges vs actual words…",
  "Translating cookbook hieroglyphics…",
  "Digitising grandma's sacred scribbles…",
  "Detecting rogue fingerprints on the page…",
  "Enhancing crumbs for better readability…",
  "Extracting ingredients hiding behind shadows…",
  "Fighting glare like a kitchen ninja…",
  "Zooming in on smudged measurements…",
  "Guessing if that says \"tsp\" or \"chaos\"…",
  "Scanning recipe like a hungry robot…",
  "Decoding cookbook calligraphy…",
  "Turning photographed chaos into edible order…",
  
  // Recipe Construction
  "Assembling ingredients alphabetically…",
  "Stirring the instructions clockwise…",
  "Letting the instructions simmer…",
  "Folding emotions gently into the recipe card…",
  "Seasoning your recipe with charm…",
  "Checking expiry dates on digital flour…",
  "Aligning the dl, dt, and dd tags like plates…",
  "Mixing your ingredients with 0% mess…",
  "Kneading your content until smooth…",
  "Sautéing steps for extra clarity…",
  "Setting oven to AI-powered precision…",
  "Adding a pinch of formatting…",
  "Double-checking your baking times…",
  "Ensuring no rogue emojis were added…",
  "Trimming overly poetic food blogger intros…",
  "Verifying that \"pinch\" means \"pinch,\" not chaos…",
  "Confirming nobody used cups AND grams (monsters)…",
  "Translating weird American measurements…",
  "Weighing your macros like a nutrition nerd…",
  "Decluttering instructions like Marie Kondo…",
  
  // Humorous "Cookie Jar" Personality
  "Asking the cookies for advice…",
  "Shaking the jar to wake them up…",
  "Negotiating with cookie union representatives…",
  "Bribing the cookies with chocolate chips…",
  "Letting the cookies brainstorm ideas…",
  "Letting the cookie jar warm up…",
  "Cookie council reviewing your recipe…",
  "Cookies demanding a lunch break…",
  "Cookies refusing to work until given milk…",
  "Cookies performing a background check…",
  "Running on cookie energy only…",
  "Cookie Jar spinning up (literally)…",
  "Cookies arguing over seasoning amounts…",
  "Jar got stuck — giving it a little shake…",
  "Cookies loading… please hold the crumbs…",
  "Conducting cookie mood analysis…",
  "Cookie Jar is preheating…",
  "Cookies whispering flavour notes to each other…",
  "Cookies giving this recipe a vibe check…",
  "Jar is doing \"serious culinary thinking\"…",
  
  // General Loading Fun
  "Polishing your recipe card…",
  "Double-checking every crumb of data…",
  "Tidying up before you arrive…",
  "Making everything look pretty…",
  "Spinning up a culinary wormhole…",
  "Chasing runaway ingredients…",
  "Herding rogue semicolons…",
  "Removing unnecessary calories…",
  "Fact-checking the laws of thermodynamics…",
  "Adding digital parsley for presentation…",
  "Rewriting dramatic blog intros…",
  "Removing the life story nobody asked for…",
  "Correcting philosophical cooking quotes…",
  "Ensuring zero onions were harmed…",
  "Putting the recipe through finishing school…",
  "Giving your recipe a confidence boost…",
  "Giving the oven a pep talk…",
  "Ensuring hydration levels (for both you & dough)…",
  "Tasting data… it's almost ready…",
  "Cooking up something beautiful for you…",
  "Running quality checks with tiny chef hats…",
  "Teleporting spice particles…",
  "Asking AI-Gordon Ramsay for approval…",
  "Ensuring your recipe doesn't self-destruct…",
  "Sending ingredients through customs…",
  "Measuring the vibes… almost perfect…",
  "Confirming thyme is real and not a social construct…",
  "Running carbo-loading subroutines…",
  "Buttering up the server for better performance…",
  "Everything's ready… warming the plate…",
]

interface LoadingOverlayProps {
  onCancel?: () => void
}

export default function LoadingOverlayV2({ onCancel }: LoadingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  // Cycle through messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length)
    }, 3000)

    return () => clearInterval(messageInterval)
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-[9999]">
      {/* CANCEL BUTTON */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-all"
          aria-label="Cancel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* CENTRAL LOADING CARD */}
      <div className="bg-white p-10 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center max-w-md w-full mx-4 border border-gray-100">
        
        {/* SPINNER CONTAINER */}
        <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
          {/* Rotating Ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-gray-200 animate-[spin_8s_linear_infinite]" />
          <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-transparent border-t-[#D34E4E] animate-[spin_3s_linear_infinite]" />
          
          {/* Static Icon */}
          <div className="relative z-10">
             <Image
              src="/Logo/frame-1.png"
              alt="Loading"
              width={80}
              height={80}
              className="block"
              priority
            />
          </div>
        </div>

        {/* MESSAGE */}
        <div className="h-16 flex items-center justify-center w-full">
          <p 
            key={messageIndex}
            className="text-lg text-gray-700 text-center font-medium animate-[fadeIn_0.5s_ease-out]"
          >
            {messages[messageIndex]}
          </p>
        </div>

        {/* PROGRESS BAR (Indeterminate) */}
        <div className="w-full h-1 bg-gray-100 rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-[#D34E4E] rounded-full animate-[indeterminate_1.5s_infinite_linear] w-full origin-left" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(0%) scaleX(0.5); }
          100% { transform: translateX(100%) scaleX(0.2); }
        }
      `}</style>
    </div>
  )
}

