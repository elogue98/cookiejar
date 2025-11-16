'use client'

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
      <div className="w-full rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
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

