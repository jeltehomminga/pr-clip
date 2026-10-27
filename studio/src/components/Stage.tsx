import React, { createContext, useContext } from "react"
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"

export type Tone = "light" | "dark"

const ToneContext = createContext<Tone>("light")

/** The stage's tone, for everything whose colours follow the background (Text, frames). */
export const useTone = () => useContext(ToneContext)

/** Drop shadow under PhoneFrame / BrowserFrame: soft on the light stage, deep on the dark one. */
export const frameShadow = {
  light: `0 40px 80px -28px ${brand.colors.neutral900}40`,
  dark: "0 60px 120px -30px rgba(0,0,0,0.8)",
} as const

/** Slow drift keeps the dark ground alive without ever drawing attention to itself. */
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / durationInFrames

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at ${interpolate(t, [0, 1], [14, 32])}% ${interpolate(
          t,
          [0, 1],
          [6, 18],
        )}%, ${brand.colors.primary700}66 0%, transparent 62%),
                     radial-gradient(95% 70% at ${interpolate(t, [0, 1], [94, 74])}% ${interpolate(
                       t,
                       [0, 1],
                       [96, 84],
                     )}%, ${brand.colors.primary400}30 0%, transparent 58%)`,
      }}
    />
  )
}

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(78% 78% at 50% 48%, transparent 42%, rgba(0,0,0,0.5) 100%)",
      pointerEvents: "none",
    }}
  />
)

/**
 * Static film grain. A fixed turbulence seed keeps it from shimmering, which
 * would cost h264 bitrate for no visible gain.
 */
const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
)

type StageProps = {
  /**
   * light: the static brand gradient, nothing else - the default, and the only
   * tone for anything customer-facing. dark: neutral900 with a slow green drift,
   * grain and a vignette - internal videos only.
   */
  tone: Tone
  /** The light tone's ground instead of the brand gradient. */
  ground?: string
  children: React.ReactNode
}

export const Stage: React.FC<StageProps> = ({ tone, ground = brand.gradients.light, children }) => {
  const dark = tone === "dark"

  return (
    <ToneContext.Provider value={tone}>
      <AbsoluteFill
        style={{
          background: dark ? brand.colors.neutral900 : ground,
          fontFamily: brand.type.family,
          letterSpacing: brand.type.tracking,
        }}
      >
        {/* Under the content: over it, the vignette would shade a before and an after
            screen differently, and grain would add noise to the captures. */}
        {dark && (
          <>
            <Backdrop />
            <Vignette />
            <Grain />
          </>
        )}
        {children}
      </AbsoluteFill>
    </ToneContext.Provider>
  )
}
