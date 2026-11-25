import { createContext, useContext } from "react"

import type { Capture } from "../pr-clip/timeline"

export type FrameGeometry = {
  source: Pick<Capture, "width" | "height">
  cropBottom: number
  screenHeight: number
  /** The capture is in dark mode: brackets over it take the bright shades (brand.ring). */
  dark: boolean
}

const FrameContext = createContext<FrameGeometry | null>(null)

export const FrameProvider = FrameContext.Provider

/**
 * Geometry of the frame an overlay is drawn inside. Anything positioned in source
 * pixels (Highlight) has to be a descendant of PhoneFrame / BrowserFrame, under the
 * same transform as the capture: rendered beside the frame it misses the bezel
 * offset and the frame's lean-in, and drifts off its target as the beat runs.
 */
export const useFrame = () => {
  const geometry = useContext(FrameContext)
  if (!geometry) {
    throw new Error(
      "Highlight must be rendered inside PhoneFrame or BrowserFrame (use the overlay prop)",
    )
  }
  return geometry
}
