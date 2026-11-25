import React from "react"
import { spring, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"

const { colors, motion } = brand

/** A spring this close to 1 has landed: draw it with no transform or filter, so the text stays crisp. */
const landed = (p: number) => Math.abs(1 - p) < 0.002

/** The brand spring from `delay`. */
const useEntrance = (delay: number) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: brand.spring })
}

/** Rise, sharpen and fade in: the shared entrance, as styles for a progress `p` (0 → 1, may overshoot). */
const sharpen = (p: number, rise: number): React.CSSProperties =>
  landed(p)
    ? {}
    : { opacity: Math.min(1, Math.max(0, p)), filter: `blur(${(Math.max(0, 1 - p) * motion.words.blur).toFixed(2)}px)`, transform: `translateY(${((1 - p) * rise).toFixed(2)}px)` }

type RiseProps = {
  delay?: number
  children: React.ReactNode
  style?: React.CSSProperties
}

/** One block rising in from a blur on the brand spring. */
export const Rise: React.FC<RiseProps> = ({ delay = 0, children, style }) => (
  <div style={{ ...sharpen(useEntrance(delay), 24), ...style }}>{children}</div>
)

type WordProps = { word: string; delay: number; mask: boolean }

const Word: React.FC<WordProps> = ({ word, delay, mask }) => {
  const p = useEntrance(delay)
  if (!mask) return <span style={{ display: "inline-block", ...sharpen(p, motion.words.rise) }}>{word}</span>
  // The mask has room above and below the line for ascenders, descenders and the overshoot, and
  // takes it back with negative margins, so a masked line is as tall as a plain one.
  return (
    <span style={{ display: "inline-block", verticalAlign: "top", overflow: "hidden", padding: "0.12em 0 0.16em", margin: "-0.12em 0 -0.16em" }}>
      <span style={{ display: "inline-block", transform: landed(p) ? undefined : `translateY(${((1 - p) * 115).toFixed(2)}%)` }}>{word}</span>
    </span>
  )
}

type WordsProps = {
  text: string
  /** Frame the first word starts; the next ones follow `motion.words.stagger` frames apart. */
  at: number
  /** Each word rises out of a mask (titles) instead of sharpening from a blur (captions). */
  mask?: boolean
}

/**
 * Text that comes in word by word. The words are inline blocks with plain spaces between them, so
 * lines wrap and balance as plain text does; the motion is all transforms and filters, so layout
 * sizes (offsetHeight, scrollWidth) are those of the landed text.
 */
export const Words: React.FC<WordsProps> = ({ text, at, mask = false }) => (
  <>
    {text
      .split(" ")
      .filter(Boolean)
      .map((word, i, all) => (
        <React.Fragment key={`${i}-${word}`}>
          <Word word={word} delay={at + i * motion.words.stagger} mask={mask} />
          {i < all.length - 1 && " "}
        </React.Fragment>
      ))}
  </>
)

type EyebrowProps = { children: React.ReactNode }

export const Eyebrow: React.FC<EyebrowProps> = ({ children }) => (
  <div style={{ fontSize: 22, fontWeight: brand.type.weights.medium, letterSpacing: "0.16em", textTransform: "uppercase", color: colors.muted }}>{children}</div>
)

type SizedTextProps = { size?: number; children: React.ReactNode }

/** Tighter than the stage's tracking: big type reads better closed up. */
export const Headline: React.FC<SizedTextProps> = ({ size = 84, children }) => (
  <div style={{ fontSize: size, fontWeight: brand.type.weights.bold, lineHeight: 1.08, letterSpacing: "-0.03em", color: colors.text }}>{children}</div>
)

export const Body: React.FC<SizedTextProps & { color?: string }> = ({ size = 34, color = colors.muted, children }) => (
  <div style={{ fontSize: size, fontWeight: brand.type.weights.regular, lineHeight: 1.45, color }}>{children}</div>
)

/**
 * The chip's slot height. timeline's frameTop (114 = 40 padding + this + a 22 px gap) is measured
 * from it, so the chip itself can stay small inside it.
 */
const chipSlot = 52

type ChipProps = {
  /** The dot's colour: brand.ring.problem for a before, brand.ring.fix for an after. */
  dot: string
  children: React.ReactNode
}

/** A small glass label above a frame, its dot saying problem or fix; sentence case. */
export const Chip: React.FC<ChipProps> = ({ dot, children }) => (
  <div style={{ height: chipSlot, display: "flex", alignItems: "flex-end" }}>
    <div
      style={{
        height: 42,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "0 18px 0 15px",
        borderRadius: 12,
        background: brand.glass.fill,
        border: `1px solid ${brand.glass.border}`,
        boxShadow: `inset 0 1px 0 ${brand.glass.sheen}`,
        fontSize: 21,
        fontWeight: brand.type.weights.medium,
        color: colors.text,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: 999, background: dot, boxShadow: `0 0 10px ${dot}` }} />
      {children}
    </div>
  </div>
)
