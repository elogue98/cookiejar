'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { LOADING_MESSAGES } from './loadingMessages'

interface LoadingOverlayProps {
  onCancel?: () => void
}

export default function LoadingOverlayV2({ onCancel }: LoadingOverlayProps) {
  const messages = LOADING_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)

  // Cycle through messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length)
    }, 3000)

    return () => clearInterval(messageInterval)
  }, [messages.length])

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
