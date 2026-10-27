import React from "react"
import { Img, OffthreadVideo, Sequence, staticFile } from "remotion"

type ClipWithHoldsProps = {
  /**
   * File at the root of the clip's public dir (videos/<KEY>/media). Its holds are
   * `<name>-first.png` and `<name>-last.png` beside it, written by
   * `scripts/extract-holds.sh <KEY> <file> [trimBefore] [trimAfter]` from the same
   * frames trimBefore/trimAfter select here.
   */
  clip: string
  trimBefore: number
  trimAfter: number
  /** Frame within the beat where the clip starts playing; the first frame holds until then. */
  startAt: number
  /** A hard cut: play trimBefore to `at`, then `to` to trimAfter. */
  jump?: { at: number; to: number }
}

/**
 * A recording that fills its whole beat. An OffthreadVideo renders nothing
 * outside its own window, so a clip shorter than the beat leaves a blank screen
 * at either end. Holding the clip's real first and last frames covers both gaps;
 * the cut is invisible because the images are identical to the frames they sit
 * against. Never place a bare OffthreadVideo in a beat.
 */
export const ClipWithHolds: React.FC<ClipWithHoldsProps> = ({
  clip,
  trimBefore,
  trimAfter,
  startAt,
  jump,
}) => {
  const base = clip.replace(/\.[^.]+$/, "")
  const parts = jump ? [[trimBefore, jump.at], [jump.to, trimAfter]] : [[trimBefore, trimAfter]]
  const playFor = parts.reduce((n, [from, to]) => n + to - from, 0)
  const fill = { width: "100%" } as const
  let at = startAt

  return (
    <>
      {startAt > 0 && (
        <Sequence durationInFrames={startAt}>
          <Img src={staticFile(`${base}-first.png`)} style={fill} />
        </Sequence>
      )}
      {parts.map(([from, to]) => {
        const part = (
          <Sequence key={from} from={at} durationInFrames={to - from}>
            <OffthreadVideo src={staticFile(clip)} trimBefore={from} trimAfter={to} style={fill} />
          </Sequence>
        )
        at += to - from
        return part
      })}
      <Sequence from={startAt + playFor}>
        <Img src={staticFile(`${base}-last.png`)} style={fill} />
      </Sequence>
    </>
  )
}
