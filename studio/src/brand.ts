/**
 * Brand data for every video. Plain values: no React, no Remotion.
 *
 * This is the one file to swap for your own brand. The defaults are Tailwind's slate,
 * green and orange. Keep the keys: the components read them by name. Copy your shades
 * from your design tokens rather than inventing them here.
 */
export const colors = {
  shade0: "#ffffff",
  neutral50: "#f8fafc",
  neutral100: "#f1f5f9",
  neutral200: "#e2e8f0",
  neutral300: "#cbd5e1",
  neutral400: "#94a3b8",
  neutral500: "#64748b",
  neutral600: "#475569",
  neutral700: "#334155",
  neutral800: "#1e293b",
  neutral900: "#0f172a",
  primary400: "#16a34a",
  primary500: "#15803d",
  primary600: "#166534",
  primary700: "#14532d",
  secondary400: "#f97316",
  secondary600: "#c2410c",
  tertiary400: "#2563eb",
  darkNeutral50: "#1f2937",
  darkNeutral100: "#2b3543",
  darkNeutral400: "#6b7280",
  darkNeutral500: "#9ca3af",
  darkNeutral900: "#f8fafc",
  darkPrimary500: "#22c55e",
} as const

export const gradients = {
  light: "linear-gradient(137deg, #ffffff 0%, #e2e8f0 100%)",
  green: "linear-gradient(180deg, #4ade80 0%, #15803d 100%)",
  dark: "linear-gradient(180deg, #64748b 0%, #0f172a 100%)",
} as const

/**
 * Highlight rings: orange marks the problem (before), green the fix (after).
 * Orange on white is about 3:1, so it is for rings and large shapes only, never text.
 */
export const ring = {
  problem: colors.secondary400,
  fix: colors.primary400,
} as const

export const type = {
  family: "Schibsted Grotesk",
  tracking: "-0.02em",
  weights: { regular: 400, semiBold: 600, bold: 700, extraBold: 800 },
  /** Burned-in caption font size in px: the minimum, never smaller. */
  caption: 54,
} as const

/** The standard curve: moves, and the wipe between before and after. */
const standard = [0.2, 0, 0, 1] as const

/**
 * Easing presets. `frames` at 30 fps; `curve` holds the four Easing.bezier arguments:
 * `Easing.bezier(...motion.enter.curve)`.
 */
export const motion = {
  /** Overlay entrances (rings, captions, chips). */
  enter: { curve: [0.05, 0.7, 0.1, 1], frames: 15 },
  exit: { curve: [0.3, 0, 0.8, 0.15], frames: 6 },
  move: { curve: standard, frames: 18 },
  wipe: { curve: standard, frames: 15 },
  /**
   * A pair leans in on its fix once the after state has landed: a push-transition curve,
   * 1 s (the top of the 600–1000 ms camera range). 1.25× is the fallback strength when
   * a clip opts out of the fit zoom; it stays subtle and far under the 2× cap.
   */
  camera: { curve: [0.4, 0, 0.2, 1], frames: 30, zoom: 1.25 },
} as const

/**
 * The only spring config in the studio. Remotion's default (damping 10) bounces,
 * and bounce is a banned look; damping 200 settles without overshoot.
 */
export const spring = { damping: 200, mass: 0.5 } as const
