'use client'

import { useId } from 'react'
import styles from './KitchenLoading.module.css'

const CHIPS = [
  { x: 33, y: 29, angle: -18, size: 1 },
  { x: 57, y: 23, angle: 24, size: .8 },
  { x: 70, y: 44, angle: -12, size: 1.1 },
  { x: 45, y: 48, angle: 32, size: 1.2 },
  { x: 26, y: 57, angle: 14, size: .8 },
  { x: 54, y: 70, angle: -26, size: 1 },
  { x: 69, y: 64, angle: 45, size: .5 },
]

const TEXTURE = [
  [28, 21, 1], [43, 18, .8], [47, 31, 1.2], [22, 39, .8],
  [36, 42, 1], [58, 39, .7], [76, 34, .8], [18, 51, .9],
  [36, 63, .8], [43, 73, 1.1], [63, 56, .8], [73, 55, .9],
  [31, 71, 1], [59, 79, .7], [48, 58, .8], [58, 52, .7],
  [39, 54, .6], [64, 32, .9], [21, 66, .6], [39, 80, .7],
]

// Each bite overlaps the previous one, leaving a scalloped edge and fewer chips.
const BITES = [
  { stage: 'one', circles: [[67, 12, 18], [82, 25, 19], [90, 42, 16]], crumb: [74, 29] },
  { stage: 'two', circles: [[84, 53, 21], [77, 73, 20], [64, 85, 16]], crumb: [74, 65] },
  { stage: 'three', circles: [[38, 9, 19], [22, 20, 20], [13, 35, 17]], crumb: [29, 29] },
  { stage: 'four', circles: [[15, 64, 22], [31, 82, 22], [47, 88, 16]], crumb: [30, 68] },
  { stage: 'five', circles: [[46, 46, 30]], crumb: [48, 48] },
]

export default function KitchenLoading() {
  const maskId = useId()
  const doughId = `${maskId}-dough`
  const chocolateId = `${maskId}-chocolate`

  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.illustration} aria-hidden="true">
        <svg className={styles.cookie} viewBox="0 0 96 112" fill="none">
          <defs>
            <radialGradient id={doughId} cx="40%" cy="34%" r="67%">
              <stop offset="0" stopColor="#E3C18B" />
              <stop offset=".65" stopColor="#D6AE73" />
              <stop offset=".9" stopColor="#BD8C52" />
              <stop offset="1" stopColor="#A97540" />
            </radialGradient>
            <linearGradient id={chocolateId} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#72513D" />
              <stop offset="1" stopColor="#422E26" />
            </linearGradient>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="112" style={{ maskType: 'luminance' }}>
              <rect width="96" height="112" fill="white" />
              {BITES.map(bite => (
                <g key={bite.stage} className={styles.bite} data-bite={bite.stage} fill="black">
                  {bite.circles.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
                </g>
              ))}
            </mask>
          </defs>
          <g className={styles.biscuit}>
            <g mask={`url(#${maskId})`}>
              <path d="M48 10C57 9 65 13 71 18C79 23 84 33 85 43C87 53 82 65 77 72C70 81 59 85 49 86C38 87 27 82 20 75C12 67 9 56 10 46C9 36 15 24 23 18C30 12 39 9 48 10Z" fill={`url(#${doughId})`} />
              <path d="M22 36L28 40L26 46M51 15L49 21M60 61L64 65L62 71M35 76L39 71" stroke="#A87542" strokeOpacity=".2" strokeWidth=".7" strokeLinecap="round" />
              {TEXTURE.map(([cx, cy, r]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={r} fill="#946332" opacity=".25" />
                  <circle cx={cx - .3} cy={cy - .5} r={r * .6} fill="#F7DFB4" opacity=".5" />
                </g>
              ))}
              {CHIPS.map(({ x, y, angle, size }) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
                  <path d="M-4-3L1-5L5-1L3 4L-2 5L-5 1Z" fill="#A16F43" opacity=".3" transform="translate(0 1) scale(1.2)" />
                  <path d="M-4-3L1-5L5-1L3 4L-2 5L-5 1Z" fill={`url(#${chocolateId})`} />
                  <path d="M-3-2L1-3.5L3-1" stroke="#A38165" strokeWidth=".8" strokeOpacity=".55" strokeLinecap="round" />
                </g>
              ))}
            </g>
          </g>
          {BITES.map(bite => (
            <g key={bite.stage} transform={`translate(${bite.crumb.join(' ')})`}>
              <g className={styles.fallingCrumbs} data-bite={bite.stage} fill="#B88C56">
                <circle cx="-7" cy="1" r="1.6" />
                <circle cx="3" cy="6" r="1.3" />
                <circle cx="9" cy="-2" r="1" />
              </g>
            </g>
          ))}
        </svg>
      </div>
      <p className={styles.label}>Getting your kitchen ready…</p>
    </div>
  )
}
