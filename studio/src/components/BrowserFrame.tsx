import React from "react"

import * as brand from "../brand"
import type { Capture, Rect } from "../pr-clip/timeline"
import { FrameProvider } from "./FrameContext"
import { frameShadow, useTone } from "./Stage"

type BrowserFrameProps = {
  /** The capture being shown - its measured source size, from props.json. */
  source: Pick<Capture, "width" | "height">
  /** Rendered height of the visible page area, in composition pixels. */
  screenHeight: number
  /** Shown in the address pill. */
  url?: string
  /**
   * Source pixels hidden from the bottom of the capture without scaling the
   * content (a dev overlay, a chat bubble). Every capture shown inside this frame
   * must share it, or a dissolve between them changes scale.
   */
  cropBottom?: number
  /** The capture is in dark mode: dark chrome, and the dark page colour until it loads. */
  dark?: boolean
  /**
   * Drawn over the page, on top of the content and under the same transform, but not
   * clipped by the window's edge, so brackets around an element near it keep their
   * arms. Highlight belongs here (or in the children, to sit under a wipe) rather
   * than beside the frame - outside, it misses the title bar offset.
   */
  overlay?: React.ReactNode
  /**
   * Lean-in toward a rect of the capture (source pixels), as on PhoneFrame: the whole window scales,
   * to `to` (default brand.motion.camera.zoom), and moves by `shift` px (at progress 1) as it does.
   */
  zoom?: { rect: Rect; progress: number; to?: number; shift?: { x: number; y: number } }
  children: React.ReactNode
}

/** Window buttons, drawn grey from the tokens rather than in macOS colours. */
const dotKeys = ["close", "minimise", "zoom"]

/**
 * Web sibling of PhoneFrame. CDP screenshots carry no browser chrome, so the
 * title bar, address pill, corner radius and shadow are drawn here. The page box
 * has the exact structure of the phone's screen box (visible height, overflow
 * hidden, full-height inner layer), so Highlight's source-pixel maths is the same
 * for both.
 */
export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  source,
  screenHeight,
  url = "",
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
  const radius = 14
  const barHeight = 44
  const geometry = { source, cropBottom, screenHeight }
  // Origin unclamped, as on PhoneFrame; `shift` pans the window on the way in.
  const lean = zoom && {
    transform: `translate(${(zoom.shift?.x ?? 0) * zoom.progress}px, ${(zoom.shift?.y ?? 0) * zoom.progress}px) scale(${1 + ((zoom.to ?? brand.motion.camera.zoom) - 1) * zoom.progress})`,
    transformOrigin: `${(zoom.rect.left + zoom.rect.width / 2) * scale}px ${barHeight + (zoom.rect.top + zoom.rect.height / 2) * scale}px`,
  }

  return (
    // As wide as the page: a long address in a narrow (phone-size) window ends in an ellipsis
    // instead of widening the window past its page.
    <div style={{ position: "relative", width: screenWidth, ...lean }}>
      <div
        style={{
          borderRadius: radius,
          overflow: "hidden",
          background: dark ? brand.colors.darkNeutral100 : brand.colors.neutral200,
          boxShadow: `${frameShadow[tone]}, 0 0 0 1px ${brand.colors.neutral700}77`,
        }}
      >
        <div
          style={{
            height: barHeight,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
          }}
        >
          {dotKeys.map((key) => (
            <div
              key={key}
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: dark ? brand.colors.darkNeutral400 : brand.colors.neutral400,
              }}
            />
          ))}
          <div
            style={{
              flex: 1,
              margin: "0 12px 0 16px",
              height: 26,
              borderRadius: 13,
              background: dark ? brand.colors.darkNeutral50 : brand.colors.shade0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 400,
              color: dark ? brand.colors.darkNeutral500 : brand.colors.neutral500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", padding: "0 12px" }}>{url}</span>
          </div>
        </div>
        <div
          style={{
            width: screenWidth,
            height: screenHeight,
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
      </div>
      <div style={{ position: "absolute", left: 0, top: barHeight, width: screenWidth, height: screenHeight }}>
        <FrameProvider value={geometry}>{overlay}</FrameProvider>
      </div>
    </div>
  )
}
