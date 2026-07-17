'use client'

import Image from 'next/image'
import AnimatedModal from './AnimatedModal'

interface ImageModalProps {
  imageUrl: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

export default function ImageModal({ imageUrl, alt, isOpen, onClose }: ImageModalProps) {
  return (
    <AnimatedModal
      open={isOpen}
      onClose={onClose}
      closeOnBackdrop
      closeOnEscape
      lockScroll
      ariaLabel={`Expanded image: ${alt}`}
      rootStyle={{ padding: 0, zIndex: 1000 }}
      backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      panelStyle={{
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: '90vw',
        height: '90vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
        <Image
          src={imageUrl}
          alt={alt}
          fill
          unoptimized
          sizes="90vw"
          style={{
            objectFit: 'contain',
            borderRadius: 'var(--radius-lg)',
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          aria-label="Close modal"
        >
          ✕
        </button>
    </AnimatedModal>
  )
}
