import React from "react"

import * as brand from "../brand"
import type { Capture, Rect } from "../pr-clip/timeline"
import { FrameProvider } from "./FrameContext"
import { frameShadow, useTone } from "./Stage"

type PhoneFrameProps = {
  /** The capture being shown - its measured source size, from props.json. */
  source: Pick<Capture, "width" | "height">
  /** Rendered height of the visible screen area, in composition pixels. */
  screenHeight: number
  /**
   * Source pixels hidden from the bottom of the capture without scaling the
   * content (watermark removal). Every capture shown inside this frame must share
   * it, or a dissolve between them changes scale.
   */
  cropBottom?: number
  /** The capture is in dark mode: the screen shows the dark page colour until it loads. */
  dark?: boolean
  /**
   * Drawn over the screen, on top of the content and under the same transform, but
   * not clipped by the screen's edge: app cards sit about 7 px from it, so brackets
   * 10 px outside one land on the bezel. Anything positioned from the capture's
   * source pixels (Highlight) belongs here rather than beside the frame - outside,
   * it misses the bezel offset.
   */
  overlay?: React.ReactNode
  /**
   * Lean-in toward a rect of the capture (source pixels): the whole device scales by
   * up to brand.motion.camera.zoom around the rect's centre, bezel and overlay included,
   * so it reads as the camera moving closer rather than the app zooming its UI.
   */
  zoom?: { rect: Rect; progress: number }
  children: React.ReactNode
}

/**
 * Simulator captures are raw rectangles with no device chrome, so the bezel,
 * corner radius and shadow are drawn here. The corner radius follows the
 * capture width (186px on a 1206-wide iPhone 17 Pro capture).
 */
export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  source,
  screenHeight,
  cropBottom = 0,
  dark = false,
  overlay,
  zoom,
  children,
}) => {
  const tone = useTone()
  const visibleSourceHeight = source.height - cropBottom
  const scale = screenHeight / visibleSourceHeight
  const screenWidth = source.width * scale
  const radius = source.width * 0.154 * scale
  const bezel = Math.max(6, 26 * scale)
  const geometry = { source, cropBottom, screenHeight }
  // Origin is the rect's centre, unclamped: timeline() skips the lean-in when a bracket
  // would reach the caption fade.
  const lean = zoom && {
    transform: `scale(${1 + (brand.motion.camera.zoom - 1) * zoom.progress})`,
    transformOrigin: `${bezel + (zoom.rect.left + zoom.rect.width / 2) * scale}px ${bezel + (zoom.rect.top + zoom.rect.height / 2) * scale}px`,
  }

  return (
    <div
      style={{
        position: "relative",
        padding: bezel,
        borderRadius: radius + bezel,
        background: brand.colors.neutral900,
        boxShadow: `${frameShadow[tone]}, 0 0 0 1px ${brand.colors.neutral700}77, inset 0 0 0 1px ${brand.colors.neutral700}55`,
        ...lean,
      }}
    >
      <div
        style={{
          width: screenWidth,
          height: screenHeight,
          borderRadius: radius,
          overflow: "hidden",
          position: "relative",
          backgroundColor: dark ? brand.colors.darkNeutral50 : brand.colors.neutral50,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: screenWidth,
            height: source.height * scale,
          }}
        >
          <FrameProvider value={geometry}>{children}</FrameProvider>
        </div>
      </div>
      <div style={{ position: "absolute", left: bezel, top: bezel, width: screenWidth, height: screenHeight }}>
        <FrameProvider value={geometry}>{overlay}</FrameProvider>
      </div>
    </div>
  )
}
