'use client'

import Image from 'next/image'
import { useState } from 'react'
import ImageModal from './ImageModal'

interface RecipeImageWithModalProps {
  imageUrl: string
  alt: string
}

export default function RecipeImageWithModal({ imageUrl, alt }: RecipeImageWithModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <Image
          src={imageUrl}
          alt={alt}
          fill
          unoptimized
          className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
          sizes="(min-width: 1024px) 50vw, 100vw"
          onClick={() => setIsModalOpen(true)}
        />
      </div>
      <ImageModal
        imageUrl={imageUrl}
        alt={alt}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
