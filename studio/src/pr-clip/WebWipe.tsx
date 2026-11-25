import React from "react"
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion"

import { motion, ring } from "../brand"
import { BrowserFrame } from "../components/BrowserFrame"
import { ClipWithHolds } from "../components/ClipWithHolds"
import { Highlight } from "../components/Highlight"
import { Chip } from "../components/Text"
import { captionFade, lean, leanFeel } from "./lean"
import { camera, fitZoom, isVideo, webScreen, wipeFrames, type Capture, type Mark, type Pair, type PairBeat } from "./timeline"

/** Page height inside the browser frame; leaves room for the chip and the caption band. */
const screenHeight = webScreen
const fill = { width: "100%" } as const

type WebWipeProps = {
  pair: Pair
  beat: PairBeat
  url?: string
  /** Lean-in strength: a number, or "fit" (see fitZoom); either also pans the fix to the window's middle. Default: brand.motion.camera.zoom, no pan. */
  zoomTo?: number | "fit"
  /** How the brackets behave (Mark): they stay by default. */
  mark?: Mark
}

/** A still, or a recording held on its first frame until playAt and on its last frame after. */
export const Page: React.FC<{ capture: Capture; playAt: number }> = ({ capture, playAt }) =>
  isVideo(capture) ? (
    <ClipWithHolds clip={capture.file} trimBefore={capture.trimBefore ?? 0} trimAfter={capture.trimAfter!} startAt={playAt} />
  ) : (
    <Img src={staticFile(capture.file)} style={fill} />
  )

type EdgeProps = { progress: number }

/**
 * The wipe's edge: a thin teal line with a soft glow, and a faint trail on the after side that
 * shows which way it travels. Only while the wipe runs.
 */
const Edge: React.FC<EdgeProps> = ({ progress }) => (
  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${progress * 100}%`, width: 0 }}>
    <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 90, background: `linear-gradient(90deg, transparent, ${ring.fix}26)` }} />
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: -1,
        width: 2,
        background: ring.fix,
        boxShadow: `0 0 0 1px ${ring.onLight.fix}80, 0 0 14px 2px ${ring.fix}b3, 0 0 40px 6px ${ring.fix}4d`,
      }}
    />
  </div>
)

/**
 * One browser frame. A before recording plays out first. The after page is revealed left to right
 * behind a thin luminous edge; it covers the before brackets as it goes, and the after brackets come
 * in once it has landed. The chip flips at the halfway point. Then the window leans in on the fix
 * (with a slight tilt and blur while it moves), and the chip fades while it does.
 */
export const WebWipe: React.FC<WebWipeProps> = ({ pair, beat, url, zoomTo, mark }) => {
  const frame = useCurrentFrame()
  const wipeAt = beat.wipeAt ?? 0
  const progress = interpolate(frame, [wipeAt, wipeAt + wipeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...motion.wipe.curve),
  })
  const showsAfter = progress >= 0.5
  const wiping = progress > 0 && progress < 1
  const leaned = lean(frame, beat)
  const focus = pair.after.rings?.[0]
  const to = focus && zoomTo !== undefined ? (zoomTo === "fit" ? fitZoom(focus, pair.after) : zoomTo) : undefined

  return (
    <AbsoluteFill style={{ alignItems: "center", gap: 22, paddingTop: 40, ...captionFade(leaned) }}>
      <div style={{ opacity: 1 - leaned }}>
        <Chip dot={showsAfter ? ring.fix : ring.problem}>{showsAfter ? "After" : "Before"}</Chip>
      </div>
      <div style={leanFeel(frame, beat)}>
        <BrowserFrame
          source={pair.before}
          screenHeight={screenHeight}
          url={url}
          cropBottom={pair.before.cropBottom}
          dark={pair.before.dark}
          zoom={focus && { rect: focus, progress: leaned, to, shift: to === undefined ? undefined : camera(focus, pair.after, to) }}
        >
          <Page capture={pair.before} playAt={beat.playAt} />
          {pair.before.rings?.map((r) => (
            <Highlight
              key={`before-${r.left}-${r.top}-${r.width}-${r.height}`}
              rect={r}
              kind="problem"
              delay={beat.beforeRingsAt + (r.delay ?? 0)}
              look={mark}
            />
          ))}
          <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
            <Page capture={pair.after} playAt={beat.afterPlayAt ?? 0} />
          </AbsoluteFill>
          {wiping && <Edge progress={progress} />}
          {pair.after.rings?.map((r) => (
            <Highlight
              key={`after-${r.left}-${r.top}-${r.width}-${r.height}`}
              rect={r}
              kind="fix"
              delay={beat.afterRingsAt + (r.delay ?? 0)}
              look={mark}
            />
          ))}
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  )
}
