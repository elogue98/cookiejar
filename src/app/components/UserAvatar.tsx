'use client'

interface UserAvatarProps {
  src: string
  alt: string
  name: string
  size?: 'small' | 'default'
}

export default function UserAvatar({ src, alt, name, size = 'default' }: UserAvatarProps) {
  const sizeClass = size === 'small' ? 'w-6 h-6' : 'w-8 h-8'
  const borderWidth = size === 'small' ? '1px' : '2px'
  
  return (
    <div className="flex items-center" title={`Uploaded by ${name}`}>
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover`}
        style={{ 
          borderColor: 'var(--accent-gold)',
          borderWidth: borderWidth,
          borderStyle: 'solid'
        }}
        onError={(e) => {
          // Fallback if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
        }}
      />
    </div>
  )
}

