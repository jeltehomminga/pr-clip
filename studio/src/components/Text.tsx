import React from "react"
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"
import { useTone } from "./Stage"

/** Text colours per stage tone. `onAccent` is the text colour on an accent fill. */
const palette = {
  light: {
    text: brand.colors.neutral900,
    body: brand.colors.neutral600,
    accent: brand.colors.primary500,
    onAccent: brand.colors.shade0,
  },
  dark: {
    text: brand.colors.neutral50,
    body: brand.colors.neutral400,
    accent: brand.colors.darkPrimary500,
    onAccent: brand.colors.neutral900,
  },
} as const

type RiseProps = {
  delay?: number
  children: React.ReactNode
  style?: React.CSSProperties
}

/** Spring-driven rise + fade, the single entrance used by every text element. */
export const Rise: React.FC<RiseProps> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = spring({ frame: frame - delay, fps, config: brand.spring })

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [26, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

type EyebrowProps = { children: React.ReactNode }

export const Eyebrow: React.FC<EyebrowProps> = ({ children }) => {
  const { accent } = palette[useTone()]

  return (
    <div
      style={{
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: 3.5,
        textTransform: "uppercase",
        color: accent,
      }}
    >
      {children}
    </div>
  )
}

type SizedTextProps = { size?: number; children: React.ReactNode }

/** Tracking comes from the Stage root (-0.02em, the token value). */
export const Headline: React.FC<SizedTextProps> = ({ size = 84, children }) => {
  const { text } = palette[useTone()]

  return (
    <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.06, color: text }}>
      {children}
    </div>
  )
}

export const Body: React.FC<SizedTextProps> = ({ size = 34, children }) => {
  const { body } = palette[useTone()]

  return (
    <div style={{ fontSize: size, fontWeight: 400, lineHeight: 1.45, color: body }}>
      {children}
    </div>
  )
}

type ChipProps = {
  /** outline: neutral, for "Before". solid: green, for "After" - green keeps meaning the fix. */
  tone?: "solid" | "outline"
  children: React.ReactNode
}

/** Small pill used for labels above frames and for segment chips. */
export const Chip: React.FC<ChipProps> = ({ tone = "outline", children }) => {
  const { body, accent, onAccent } = palette[useTone()]

  return (
    <div
      style={{
        display: "inline-block",
        padding: "10px 22px",
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 600,
        whiteSpace: "nowrap",
        // Both tones carry the 2px border, so an outline and a solid chip side by side match in size.
        ...(tone === "solid"
          ? { background: accent, border: `2px solid ${accent}`, color: onAccent }
          : { border: `2px solid ${body}`, color: body }),
      }}
    >
      {children}
    </div>
  )
}

/** Headline with a green rule down its left edge, for the side-column layouts. */
export const AccentHeadline: React.FC<SizedTextProps> = ({ size = 64, children }) => {
  const { accent } = palette[useTone()]

  return (
    <div style={{ display: "flex", gap: 28 }}>
      <div style={{ width: 6, borderRadius: 3, background: accent, flexShrink: 0 }} />
      <Headline size={size}>{children}</Headline>
    </div>
  )
}
