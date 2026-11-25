import React from "react"
import { Img, staticFile, useCurrentFrame } from "remotion"

import { ring } from "../brand"

import { ClipWithHolds } from "../components/ClipWithHolds"
import { Highlight } from "../components/Highlight"
import { PhoneFrame } from "../components/PhoneFrame"
import { Chip } from "../components/Text"
import { clockText, isVideo, pairScreen, type Capture, type Mark, type Rect } from "./timeline"

type PairPhoneProps = {
  capture: Capture
  label: string
  /** problem: a before, coral chip dot and brackets. fix: an after, teal. */
  kind: "problem" | "fix"
  ringsAt: number
  playAt: number
  /** Variants pass a taller screen; their bottom fades out above the caption band. */
  screenHeight?: number
  /** The pair's lean-in; the chip fades while it lasts, since the growing phone would cut it. */
  zoom?: { rect: Rect; progress: number }
  /** The lean-in's progress when the whole row leans as one (AppPair's camera): only the chip fades here. */
  leaned?: number
  /** How the brackets behave (Mark): they stay by default. */
  look?: Mark
  /** Frames a blink waits for a lean-in held past a jump (PairBeat.leanWait). */
  wait?: number
}

/** One side of an app pair: chip, phone, rings; a recording is held on its first and last frames. */
export const PairPhone: React.FC<PairPhoneProps> = ({ capture, label, kind, ringsAt, playAt, screenHeight = pairScreen, zoom, leaned, look, wait }) => {
  const frame = useCurrentFrame()
  // Tabular digits, so the chip keeps its width as the clock ticks.
  const clock = capture.clockAt !== undefined && <span style={{ fontVariantNumeric: "tabular-nums" }}> · {clockText(capture, frame, playAt)}</span>

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ opacity: 1 - (zoom?.progress ?? leaned ?? 0) }}>
        <Chip dot={ring[kind]}>
          {label}
          {clock}
        </Chip>
      </div>
      <PhoneFrame
        source={capture}
        screenHeight={screenHeight}
        cropBottom={capture.cropBottom}
        dark={capture.dark}
        zoom={zoom}
        overlay={capture.rings?.map((r) => (
          <Highlight key={`${r.left}-${r.top}-${r.width}-${r.height}`} rect={r} kind={kind} delay={ringsAt + (r.delay ?? 0)} look={look} wait={wait} />
        ))}
      >
        {isVideo(capture) ? (
          <ClipWithHolds clip={capture.file} trimBefore={capture.trimBefore ?? 0} trimAfter={capture.trimAfter!} startAt={playAt} jump={capture.jump} />
        ) : (
          <Img src={staticFile(capture.file)} style={{ width: "100%" }} />
        )}
      </PhoneFrame>
    </div>
  )
}
