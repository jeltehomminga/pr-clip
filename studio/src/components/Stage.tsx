import React from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"

/**
 * The glows: where each sits (% of the frame), its size, and how far (%) and how slowly (s per turn)
 * it swings. Slow enough that nobody watches them move: they keep the ground alive.
 */
const lights = [
  { glow: brand.glows.teal, x: 16, y: 18, size: 62, swing: 5, period: 31 },
  { glow: brand.glows.blue, x: 86, y: 84, size: 70, swing: 4, period: 37 },
  { glow: brand.glows.amber, x: 72, y: 6, size: 48, swing: 6, period: 43 },
]
/** An eased falloff, as [share of the peak alpha, stop]: a straight two-stop ramp bands on near-black. */
const falloff = [
  [1, 0],
  [0.55, 30],
  [0.18, 58],
  [0, 82],
]

/** Each glow swings on its own slow circle: a pure function of the frame. */
const Glows: React.FC = () => {
  const { fps } = useVideoConfig()
  const turn = (useCurrentFrame() / fps) * 2 * Math.PI
  const background = lights
    .map(({ glow, x, y, size, swing, period }, i) => {
      const a = turn / period + i * 2.1
      const stops = falloff.map(([share, at]) => `rgb(${glow.rgb} / ${(glow.alpha * share).toFixed(3)}) ${at}%`).join(", ")
      return `radial-gradient(${size}% ${size * 1.1}% at ${(x + swing * Math.cos(a)).toFixed(2)}% ${(y + swing * Math.sin(a)).toFixed(2)}%, ${stops})`
    })
    .join(", ")
  return <AbsoluteFill style={{ background }} />
}

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(80% 80% at 50% 46%, transparent 50%, ${brand.colors.vignette} 100%)` }} />
)

/**
 * Grain takes a new seed every 4th frame: a slow boil. A new grain every frame cost about 10 % more
 * bits in the share copy, where crf 26 smooths most of it away.
 */
const grainStep = 4

/**
 * Fine film grain from a fixed seed per step, so a frame always gets the same grain (check.sh renders
 * one twice). It also dithers the glows, which would band on their own.
 */
const Grain: React.FC = () => {
  const seed = 1 + (Math.floor(useCurrentFrame() / grainStep) % 48)
  return (
    <AbsoluteFill style={{ opacity: 0.05 }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  )
}

type StageProps = { children: React.ReactNode }

/**
 * The night stage: near-black, two cool glows and a faint warm one drifting slowly, grain and a
 * vignette. All of it sits under the content: over it, the vignette would shade a before and an after
 * screen differently, and grain would add noise to the captures.
 */
export const Stage: React.FC<StageProps> = ({ children }) => (
  <AbsoluteFill style={{ background: brand.colors.ground, fontFamily: brand.type.family, letterSpacing: brand.type.tracking }}>
    <Glows />
    <Grain />
    <Vignette />
    {children}
  </AbsoluteFill>
)
