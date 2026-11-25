import React from "react"
import { AbsoluteFill, useCurrentFrame } from "remotion"

import { captionFade, lean, leanFeel } from "./lean"
import { PairPhone } from "./PairPhone"
import { appLean, pairGap, type Pair, type PairBeat, type PrClipProps } from "./timeline"

type AppPairProps = { pair: Pair; beat: PairBeat; focus: NonNullable<PrClipProps["focus"]> }

/**
 * Before left, after right, both on screen from the first frame. Recordings start
 * together; coral brackets mark the problem, teal brackets the fix. Once the fix has
 * landed both phones lean in on the same point, so they keep sharing viewport and zoom:
 * with a focus zoom one camera on the whole row, with a pan (appLean), where the focus
 * mark takes over the brackets; with `focus: {}` each phone at 1.25x around its fix.
 */
export const AppPair: React.FC<AppPairProps> = ({ pair, beat, focus }) => {
  const frame = useCurrentFrame()
  const progress = lean(frame, beat)
  const rect = pair.after.rings?.[0]
  const fit = rect && focus.zoom !== undefined ? appLean(pair, rect, focus.zoom) : undefined
  const zoom = rect && !fit ? { rect, progress } : undefined
  const camera = fit && {
    transform: `translate(${fit.shift.x * progress}px, ${fit.shift.y * progress}px) scale(${1 + (fit.to - 1) * progress})`,
    transformOrigin: `${fit.origin.x}px ${fit.origin.y}px`,
  }
  const look = beat.zoomAt === undefined ? undefined : focus.mark

  return (
    // The caption fade stays put while the row inside it leans.
    <AbsoluteFill style={captionFade(progress)}>
      {/* The camera's tilt and blur outside its zoom, so they act on the frame as a whole. */}
      <AbsoluteFill style={leanFeel(frame, beat)}>
        <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", gap: pairGap, paddingTop: 40, ...camera }}>
          <PairPhone
            capture={pair.before}
            label="Before"
            kind="problem"
            ringsAt={beat.beforeRingsAt}
            playAt={beat.playAt}
            zoom={zoom}
            leaned={progress}
            look={look}
            wait={beat.leanWait}
          />
          <PairPhone
            capture={pair.after}
            label="After"
            kind="fix"
            ringsAt={beat.afterRingsAt}
            playAt={beat.playAt}
            zoom={zoom}
            leaned={progress}
            look={look}
            wait={beat.leanWait}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
