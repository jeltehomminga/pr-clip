import React, { useLayoutEffect, useRef } from "react"
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"
import { BrowserFrame } from "../components/BrowserFrame"
import { Highlight } from "../components/Highlight"
import { PhoneFrame } from "../components/PhoneFrame"
import { Body, Rise, Words } from "../components/Text"
import { QrCode } from "./QrCode"
import { crossfade, day, isVideo, type Capture, type Details, type Fact } from "./timeline"

const { colors, glass } = brand

/** The type column at the left, centred top to bottom between the margins. Beside an app's phone it can run wider. */
const left = 120
const margin = 100
const columnWidth = { app: 1040, web: 860 } as const
const titleSize = 60
/** Two lines at most; the title's line height is 1.08. */
const titleMax = Math.ceil(titleSize * 1.08 * 2) + 1
/** The hero floats centred right. */
const heroRight = 120
const heroPhone = 820
const heroWeb = 680
/**
 * Nothing moves under the dissolve from the beat before. Then, one after another: the dateline,
 * the title word by word, the parent issue, the why, the PR, the QR and the fact tiles; the hero
 * floats in beside them.
 */
const start = crossfade
const titleAt = start + 5
const heroAt = start + 8
const textAt = titleAt + 10
const factsAt = titleAt + 20
/** Between one fact tile and the next. */
const tileStep = 3
/** The title's first word has risen: PrClip's snap plays here. */
export const cardLands = titleAt + 8

type EndCardProps = {
  issueKey: string
  why: string
  prNumber?: number
  details: Details
  /** The first pair's after state, shown again beside the text. */
  hero: Capture
  platform: "app" | "web"
  url?: string
  /** capture.date, YYYY-MM-DD: the day the footage was taken, in the dateline. */
  captured?: string
  /** The QR of `details.url` before the facts; off with `qr: false` in props.json, or when there is no url. */
  qr: boolean
}

/** A fact tile's height: one label line and one value line. Fixed, so the QR beside the grid can match it. */
const tileHeight = 88
const tileGap = 16
const tileGlass = { borderRadius: 18, background: glass.fill, border: `1px solid ${glass.border}`, boxShadow: `inset 0 1px 0 ${glass.sheen}`, boxSizing: "border-box" } as const

type TileProps = { fact: Fact }

/** One fact on its own glass tile: the label small above, the value on one line. */
const Tile: React.FC<TileProps> = ({ fact }) => (
  <div style={{ ...tileGlass, height: tileHeight, minWidth: 0, padding: "15px 22px 0" }}>
    <div style={{ fontSize: 15, fontWeight: brand.type.weights.medium, letterSpacing: "0.12em", textTransform: "uppercase", color: colors.faint }}>{fact.label}</div>
    <div data-fact={fact.label} style={{ marginTop: 6, fontSize: 24, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", color: colors.text }}>
      {fact.value}
    </div>
  </div>
)

/** The QR tile is as wide as two fact rows are tall. */
const qrSide = 2 * tileHeight + tileGap
/** The light panel the QR sits on, inset in its glass tile. */
const qrInset = 6

type QrTileProps = { url: string; height: number }

/** The QR on a light panel inside a glass tile like the facts', its edges on the grid's. No key under it: the dateline shows it. */
const QrTile: React.FC<QrTileProps> = ({ url, height }) => (
  <div data-qr={url} style={{ ...tileGlass, width: qrSide, height, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ borderRadius: 12, background: brand.qr.panel, overflow: "hidden" }}>
      <QrCode text={url} size={qrSide - 2 * qrInset} color={brand.qr.ink} />
    </div>
  </div>
)

type HeroProps = { capture: Capture; platform: "app" | "web"; url?: string }

/** The after state once more, with its fix brackets, for anyone who jumps to the end. */
const Hero: React.FC<HeroProps> = ({ capture, platform, url }) => {
  const file = isVideo(capture) ? capture.file.replace(/\.[^.]+$/, "-last.png") : capture.file
  const overlay = capture.rings?.map((r) => (
    <Highlight key={`${r.left}-${r.top}-${r.width}-${r.height}`} rect={r} kind="fix" delay={heroAt + 16} />
  ))
  const image = <Img src={staticFile(file)} style={{ width: "100%" }} />

  if (platform === "web") {
    const screenHeight = (heroWeb * (capture.height - (capture.cropBottom ?? 0))) / capture.width
    return (
      <BrowserFrame source={capture} screenHeight={screenHeight} url={url} cropBottom={capture.cropBottom} dark={capture.dark} overlay={overlay}>
        {image}
      </BrowserFrame>
    )
  }
  return (
    <PhoneFrame source={capture} screenHeight={heroPhone} cropBottom={capture.cropBottom} dark={capture.dark} overlay={overlay}>
      {image}
    </PhoneFrame>
  )
}

/**
 * The hero floats in from the right, turned toward the text, and settles at a slight angle; from
 * there it drifts slowly (a few px a second and a degree of swing), against the still type column.
 */
const useFloat = (): React.CSSProperties => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - heroAt, fps, config: brand.spring, durationInFrames: 40 })
  const s = Math.max(0, frame - heroAt) / fps
  const x = (1 - p) * 90 - s * 4
  const y = (1 - p) * 50 + Math.sin(s * 1.1) * 5
  const turn = -9 - (1 - p) * 14 + Math.sin(s * 0.7) * 1.2
  const lean = 3 + (1 - p) * 6
  return {
    opacity: Math.min(1, Math.max(0, p * 1.6)),
    transform: `perspective(2000px) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateY(${turn.toFixed(3)}deg) rotateX(${lean.toFixed(3)}deg) scale(${(0.9 + 0.1 * p).toFixed(4)})`,
  }
}

/** The dateline's teal dot: it pops in on the spring, with a soft glow. */
const Dot: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - start, fps, config: brand.spring })
  return <div style={{ width: 10, height: 10, flexShrink: 0, borderRadius: 999, background: brand.ring.fix, boxShadow: `0 0 14px ${brand.ring.fix}`, transform: `scale(${p.toFixed(3)})` }} />
}

/**
 * The last beat when a clip has details, set on type: a column at the left, centred top to bottom,
 * with the dateline (kind · key · milestone · capture day), the title rising word by word out of a
 * mask, the parent issue, the clip's why, the PR, and the facts as glass tiles opened by the QR of
 * `details.url`, each coming in after the one before. On the right the after state floats with its
 * brackets. Facts come from what exists when the clip is made: before review and merge there are
 * fewer, and the tiles close up. A dateline wider than the column, a title over two lines, a
 * column taller than the space between the margins, or a fact wider than its tile logs `FIT:` and
 * fails check.sh.
 */
export const EndCard: React.FC<EndCardProps> = ({ issueKey, why, prNumber, details, hero, platform, url, captured, qr }) => {
  const kicker = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)
  const pr = prNumber === undefined ? details.prTitle : `#${prNumber} ${details.prTitle}`
  const showQr = qr && !!details.url
  // Two rows at least beside a QR, so it stays big enough to scan.
  const rows = Math.max(showQr ? 2 : 1, Math.ceil(details.facts.length / 2))
  // The dateline holds only what stays true once posted: the sprint, if any, and the day of the capture.
  const dateline = [details.kind, issueKey, details.sprint, captured && day(captured)].filter(Boolean).join(" · ")
  const room = 1080 - 2 * margin

  // offsetHeight is a layout size, so the entrances' transforms don't skew it.
  useLayoutEffect(() => {
    const k = kicker.current
    const t = title.current
    const c = column.current
    if (k && k.scrollWidth > k.clientWidth) console.error(`FIT: end card dateline needs ${k.scrollWidth} px of ${k.clientWidth}: "${dateline}"`)
    if (t && t.offsetHeight > titleMax) {
      console.error(`FIT: end card title needs ${t.offsetHeight} px of ${titleMax} (two lines): "${details.title}"`)
    }
    if (c && c.offsetHeight > room) console.error(`FIT: end card column needs ${c.offsetHeight} px of ${room}`)
    c?.querySelectorAll<HTMLElement>("[data-fact]").forEach((v) => {
      if (v.scrollWidth > v.clientWidth) console.error(`FIT: fact "${v.dataset.fact}" needs ${v.scrollWidth} px of ${v.clientWidth}`)
    })
  }, [details.title, dateline, room])

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left, top: margin, width: columnWidth[platform], height: room, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div ref={column}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Dot />
            <div ref={kicker} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <Rise delay={start + 2}>
                <div style={{ fontSize: 20, fontWeight: brand.type.weights.medium, letterSpacing: "0.16em", textTransform: "uppercase", color: colors.muted, whiteSpace: "nowrap" }}>{dateline}</div>
              </Rise>
            </div>
          </div>
          <div
            ref={title}
            style={{ marginTop: 22, fontSize: titleSize, fontWeight: brand.type.weights.bold, lineHeight: 1.08, letterSpacing: "-0.03em", color: colors.text, textWrap: "balance" }}
          >
            <Words text={details.title} at={titleAt} mask />
          </div>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            {!!details.parent && (
              <Rise delay={textAt}>
                <Body size={22} color={colors.faint}>
                  {details.parent}
                </Body>
              </Rise>
            )}
            <Rise delay={textAt + 3}>
              <Body size={30}>{why}</Body>
            </Rise>
            <Rise delay={textAt + 6}>
              <Body size={22} color={colors.faint}>
                {pr}
              </Body>
            </Rise>
          </div>
          <div style={{ marginTop: 34, display: "flex", gap: tileGap }}>
            {showQr && (
              <Rise delay={factsAt}>
                <QrTile url={details.url!} height={rows * tileHeight + (rows - 1) * tileGap} />
              </Rise>
            )}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: `repeat(${rows}, ${tileHeight}px)`,
                gridAutoFlow: "column",
                gap: tileGap,
              }}
            >
              {details.facts.map((f, i) => (
                <Rise key={f.label} delay={factsAt + (i + 1) * tileStep} style={{ minWidth: 0 }}>
                  <Tile fact={f} />
                </Rise>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", right: heroRight, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
        <div style={useFloat()}>
          <Hero capture={hero} platform={platform} url={url} />
        </div>
      </div>
    </AbsoluteFill>
  )
}
