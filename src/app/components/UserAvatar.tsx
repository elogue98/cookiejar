'use client'

import Image from 'next/image'

interface UserAvatarProps {
  src: string
  alt: string
  name: string
  size?: 'small' | 'default'
}

export default function UserAvatar({ src, alt, name, size = 'default' }: UserAvatarProps) {
  const sizeClass = size === 'small' ? 'w-6 h-6' : 'w-8 h-8'
  const dimension = size === 'small' ? 24 : 32
  const borderWidth = size === 'small' ? '1px' : '2px'
  
  return (
    <div className="flex items-center" title={`Uploaded by ${name}`}>
      <Image
        src={src}
        alt={alt}
        width={dimension}
        height={dimension}
        sizes={`${dimension}px`}
        className={`${sizeClass} rounded-full object-cover`}
        style={{ 
          borderColor: 'var(--accent-gold)',
          borderWidth: borderWidth,
          borderStyle: 'solid'
        }}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}
