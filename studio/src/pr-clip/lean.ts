import type React from "react"
import { Easing, interpolate } from "remotion"

import { motion } from "../brand"
import { cameraFrames, fadeTop, type PairBeat } from "./timeline"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** 0 → 1 → 0 over a pair's lean-in, hold and lean-out; 0 throughout for a pair that doesn't lean in. */
export const lean = (frame: number, { zoomAt, zoomOutAt }: PairBeat) =>
  zoomAt === undefined || zoomOutAt === undefined
    ? 0
    : interpolate(frame, [zoomAt, zoomAt + cameraFrames, zoomOutAt, zoomOutAt + cameraFrames], [0, 1, 1, 0], {
        ...clamp,
        easing: Easing.bezier(...motion.camera.curve),
      })

/**
 * While leaned in, the footage fades out above the caption band, so the caption never
 * sits over it and the band itself stays still. At rest there is no mask at all.
 */
export const captionFade = (progress: number): React.CSSProperties => {
  if (progress === 0) return {}
  const y = interpolate(progress, [0, 1], [1080, fadeTop], clamp)
  const mask = `linear-gradient(#000 ${y}px, transparent ${y + 30}px)`
  return { maskImage: mask, WebkitMaskImage: mask }
}
