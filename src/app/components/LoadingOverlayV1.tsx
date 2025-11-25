'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

const frames = [
  '/Logo/frame-1.png',
  '/Logo/frame-2.png',
  '/Logo/frame-3.png',
  '/Logo/frame-4.png',
  '/Logo/frame-5.png',
  '/Logo/frame-6.png',
]

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

export default function LoadingOverlayV1({ onCancel }: LoadingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cycle through messages with typewriter effect
  useEffect(() => {
    const currentMessage = messages[messageIndex]
    const typeSpeed = 50
    const deleteSpeed = 30
    const pauseDuration = 2000

    const handleTyping = () => {
      if (!isDeleting) {
        // Typing
        if (displayedText.length < currentMessage.length) {
          setDisplayedText(currentMessage.slice(0, displayedText.length + 1))
          typingTimeoutRef.current = setTimeout(handleTyping, typeSpeed)
        } else {
          // Finished typing, pause then delete
          typingTimeoutRef.current = setTimeout(() => setIsDeleting(true), pauseDuration)
        }
      } else {
        // Deleting
        if (displayedText.length > 0) {
          setDisplayedText(currentMessage.slice(0, displayedText.length - 1))
          typingTimeoutRef.current = setTimeout(handleTyping, deleteSpeed)
        } else {
          // Finished deleting, move to next message
          setIsDeleting(false)
          setMessageIndex((prev) => (prev + 1) % messages.length)
        }
      }
    }

    typingTimeoutRef.current = setTimeout(handleTyping, 100)

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [displayedText, isDeleting, messageIndex])

  // Continuously cycle through logo frames
  useEffect(() => {
    frameIntervalRef.current = setInterval(() => {
      setCurrentFrame((i) => (i + 1) % frames.length)
    }, 100)

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-[9999] overflow-hidden">
      {/* Radial Gradient Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 60%, rgba(240, 240, 240, 0.9) 100%)',
          backdropFilter: 'blur(8px)'
        }}
      />

      {/* CANCEL BUTTON */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-3 rounded-full hover:bg-black/5 transition-colors z-10"
          aria-label="Cancel"
          style={{ color: 'var(--text-main, #2B2B2B)' }}
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

      {/* ANIMATED CONTAINER */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Squash and Stretch Animation Wrapper */}
        <div className="animate-bounce-custom">
          <Image
            src={frames[currentFrame]}
            alt="Loading"
            width={180}
            height={180}
            className="block drop-shadow-xl"
            style={{
              display: 'block',
              transition: 'none',
            }}
          />
        </div>

        {/* TYPEWRITER MESSAGE */}
        <div className="mt-8 h-8 flex items-center justify-center">
          <p className="text-xl font-medium text-gray-800 text-center px-4 min-w-[300px]">
            {displayedText}
            <span className="animate-pulse ml-1 inline-block w-[2px] h-[20px] bg-gray-800 align-middle" />
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce-custom {
          0%, 100% {
            transform: translateY(-15%) scale(1.05, 0.95);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: translateY(0) scale(0.95, 1.05);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
        .animate-bounce-custom {
          animation: bounce-custom 1.5s infinite;
        }
      `}</style>
    </div>
  )
}

