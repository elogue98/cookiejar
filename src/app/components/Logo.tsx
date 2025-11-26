'use client'

import { useState, useEffect, useRef } from 'react'
import NextImage from 'next/image'

interface LogoProps {
  size?: number
  className?: string
}

const frames = [
  '/Logo/frame-1.png',
  '/Logo/frame-2.png',
  '/Logo/frame-3.png',
  '/Logo/frame-4.png',
  '/Logo/frame-5.png',
  '/Logo/frame-6.png',
]

export default function Logo({ size = 48, className = '' }: LogoProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameIndexRef = useRef(0)

  // Preload all frames
  useEffect(() => {
    frames.forEach((frame) => {
      const img = new window.Image()
      img.src = frame
    })
  }, [])

  // Handle animation on hover
  useEffect(() => {
    if (isHovering) {
      // Start animation: 1→2→3→4→5→6→1
      intervalRef.current = setInterval(() => {
        frameIndexRef.current = (frameIndexRef.current + 1) % frames.length
        setCurrentFrame(frameIndexRef.current)
      }, 50) // ~50ms per frame
    } else {
      // Stop animation and reset to frame 1
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      frameIndexRef.current = 0
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isHovering])

  return (
    <NextImage
      src={frames[currentFrame]}
      alt="Cookie Jar Logo"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      onMouseEnter={() => {
        frameIndexRef.current = 0
        setCurrentFrame(0)
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
        frameIndexRef.current = 0
        setCurrentFrame(0)
      }}
      priority={size >= 80}
      style={{
        display: 'block',
        transition: 'none', // No CSS transitions, we want instant frame changes
      }}
    />
  )
}
