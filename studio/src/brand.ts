/**
 * Look data for every video ("Night studio"). Plain values: no React, no Remotion.
 *
 * This is the one file to swap for your own look. Keep the keys: the components read them by name.
 */
export const colors = {
  /** The stage's near-black ground. */
  ground: "#0a0b0d",
  text: "#f5f5f4",
  muted: "#a8a29e",
  faint: "#78716c",
  /** A page's own colour inside a frame, until its capture has loaded. */
  pageLight: "#fafaf9",
  pageDark: "#1c1917",
  /** The stage's edges, darkened. */
  vignette: "rgba(0,0,0,0.55)",
} as const

/** The stage's soft glows, drifting slowly under everything (Stage): a colour and its peak alpha. */
export const glows = {
  teal: { rgb: "45 212 191", alpha: 0.2 },
  blue: { rgb: "59 130 246", alpha: 0.17 },
  amber: { rgb: "251 191 36", alpha: 0.06 },
} as const

/**
 * Frosted glass for frames, chips and tiles: a translucent fill with a slight sheen, a 1 px light
 * border, a lit top edge and a large soft shadow. A browser bar follows its page: light over a light
 * capture, dark over a dark one.
 */
export const glass = {
  fill: "linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 46%, rgba(255,255,255,0.07) 100%)",
  border: "rgba(255,255,255,0.14)",
  sheen: "rgba(255,255,255,0.22)",
  /** The dark hairline between a phone's bezel and its screen. */
  edge: "rgba(0,0,0,0.7)",
  shadow: "0 60px 120px -34px rgba(0,0,0,0.9), 0 22px 44px -24px rgba(0,0,0,0.7)",
  bar: {
    light: { fill: "linear-gradient(180deg, rgba(250,250,249,0.96), rgba(231,229,228,0.92))", field: "rgba(28,25,23,0.07)", url: "#57534e", dot: "rgba(28,25,23,0.22)", sheen: "rgba(255,255,255,0.7)" },
    dark: { fill: "linear-gradient(180deg, rgba(48,45,43,0.92), rgba(28,26,25,0.88))", field: "rgba(255,255,255,0.07)", url: "#a8a29e", dot: "rgba(255,255,255,0.2)", sheen: "rgba(255,255,255,0.12)" },
  },
} as const

/**
 * Coral marks the problem (before), teal the fix (after): chips, brackets, the wipe's edge. The bright
 * shades are for the dark stage and dark pages; on a light page they fade into the white (teal is
 * about 1.5:1 there), so brackets over a light capture take the deeper `onLight` shades (about 3.6:1).
 */
export const ring = {
  problem: "#ff7a59",
  fix: "#5eead4",
  onLight: { problem: "#e2553e", fix: "#0d9488" },
} as const

/** The end card's QR: dark modules on a light panel, the only way round that scans reliably. */
export const qr = { ink: "#0f2f2c", panel: "#f5f5f4" } as const

export const type = {
  family: "Schibsted Grotesk",
  tracking: "-0.01em",
  weights: { regular: 400, medium: 500, semiBold: 600, bold: 700 },
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
  /** A beat's frames come in lying back and stand up on the spring: rotateX in degrees, rise and scale. */
  tilt: { degrees: 8, rise: 40, scale: 0.96 },
  /** Text comes in word by word, `stagger` frames apart: from `blur` px and `rise` px below. */
  words: { stagger: 1.5, blur: 8, rise: 14 },
} as const

/**
 * The only spring config in the studio: one slight overshoot (3.6 %) that settles in about
 * 20 frames. Entrances land with a little life; nothing bounces.
 */
export const spring = { damping: 13, mass: 0.8 } as const
