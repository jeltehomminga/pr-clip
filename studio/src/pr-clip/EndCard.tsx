import React, { useLayoutEffect, useRef } from "react"
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion"

import { colors, motion, ring } from "../brand"
import { BrowserFrame } from "../components/BrowserFrame"
import { Highlight } from "../components/Highlight"
import { PhoneFrame } from "../components/PhoneFrame"
import { useTone } from "../components/Stage"
import { Body, Rise } from "../components/Text"
import { QrCode } from "./QrCode"
import { crossfade, day, isVideo, type Capture, type Details, type Fact } from "./timeline"

/**
 * The band at the top left, anchored left with a round right end, holding the kind, the key and the
 * title in white.
 */
const band = { top: 100, height: 280, width: 1140, textLeft: 120, textWidth: 880 } as const
const titleSize = 58
/** Two lines at most; the title's line height is 1.06. */
const titleMax = Math.ceil(titleSize * 1.06 * 2) + 1
/**
 * The column under the band: the parent issue, the why, the PR and the facts, ending above `bottom`. Beside an
 * app's phone it runs to the band's end; a web window is wider, so there it keeps to the band's text.
 */
const columnTop = band.top + band.height + 40
const columnWidth = { app: band.width, web: band.textWidth } as const
const bottom = 1080 - 100
/** The hero stands centred right, clear of the bottom strip. */
const heroRight = 120
const heroStrip = 110
const heroPhone = 820
const heroWeb = 620
/** The band slides in once the dissolve from the beat before is over: nothing moves under a dissolve. */
const slideFrames = 12
/** The band has landed: PrClip's snap plays here. */
export const bandLands = crossfade + slideFrames
/** Then one item every 100 ms, the facts grid as one item. */
const step = 3
const at = (item: number) => bandLands + item * step

type EndCardProps = {
  issueKey: string
  why: string
  prNumber?: number
  details: Details
  /** The first pair's after state, shown again beside the text. */
  hero: Capture
  platform: "app" | "web"
  url?: string
  /** capture.date, YYYY-MM-DD: the day the footage was taken, in the band's dateline. */
  captured?: string
  /** The QR of `details.url` before the facts; off with `qr: false` in props.json, or when there is no url. */
  qr: boolean
}

type TileProps = { fact: Fact; dark: boolean }

/** A fact tile's height: one label line and one value line. Fixed, so the QR beside the grid can match it. */
const tileHeight = 88
const tileGap = 16

/** One fact in its own tile: the label small above, the value on one line. */
const Tile: React.FC<TileProps> = ({ fact, dark }) => (
  <div
    style={{
      minWidth: 0,
      padding: "14px 22px 16px",
      borderRadius: 18,
      background: dark ? colors.neutral800 : colors.shade0,
      border: `2px solid ${dark ? colors.neutral700 : colors.neutral200}`,
    }}
  >
    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: dark ? colors.neutral400 : colors.neutral500 }}>
      {fact.label}
    </div>
    <div
      data-fact={fact.label}
      style={{ marginTop: 4, fontSize: 24, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", color: dark ? colors.neutral50 : colors.neutral900 }}
    >
      {fact.value}
    </div>
  </div>
)

/** The QR tile is as wide as two fact rows are tall, and as tall as the whole grid. */
const qrSide = 2 * tileHeight + tileGap

type QrTileProps = { url: string; height: number }

/**
 * The QR on a white tile like the facts', its edges on the grid's. No key under it: the band shows it.
 * White in both tones: a QR needs a light ground.
 */
const QrTile: React.FC<QrTileProps> = ({ url, height }) => (
  <div
    data-qr={url}
    style={{
      width: qrSide,
      height,
      flexShrink: 0,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      borderRadius: 18,
      background: colors.shade0,
      border: `2px solid ${colors.neutral200}`,
    }}
  >
    <QrCode text={url} size={qrSide - 4} color={colors.primary700} />
  </div>
)

type HeroProps = { capture: Capture; platform: "app" | "web"; url?: string }

/** The after state once more, with its fix brackets, for anyone who jumps to the end. */
const Hero: React.FC<HeroProps> = ({ capture, platform, url }) => {
  const file = isVideo(capture) ? capture.file.replace(/\.[^.]+$/, "-last.png") : capture.file
  const overlay = capture.rings?.map((r) => (
    <Highlight key={`${r.left}-${r.top}-${r.width}-${r.height}`} rect={r} color={ring.fix} delay={at(2)} />
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
 * The last beat when a clip has details. The band holds what changed: kind and key, the title. Under
 * it: the parent issue, the clip's why, the PR and the facts as tiles, opened by the QR of
 * `details.url`; on the right the after state with its brackets. Facts come from what
 * exists when the clip is made: before review and merge there are fewer, and the tiles close up. A
 * title over two lines, a fact wider than its tile, or a column past the bottom margin logs `FIT:`
 * and fails check.sh.
 */
export const EndCard: React.FC<EndCardProps> = ({ issueKey, why, prNumber, details, hero, platform, url, captured, qr }) => {
  const frame = useCurrentFrame()
  const dark = useTone() === "dark"
  const slide = interpolate(frame, [crossfade, crossfade + slideFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...motion.move.curve),
  })
  const kicker = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)
  const pr = prNumber === undefined ? details.prTitle : `#${prNumber} ${details.prTitle}`
  const showQr = qr && !!details.url
  // Two rows at least beside a QR, so it stays big enough to scan.
  const rows = Math.max(showQr ? 2 : 1, Math.ceil(details.facts.length / 2))
  // The dateline holds only what stays true once posted: the sprint, if any, and the day of the capture.
  const dateline = [details.kind, issueKey, details.sprint, captured && day(captured)].filter(Boolean).join(" · ")

  // offsetHeight and offsetTop are layout sizes, so the Rise transforms don't skew them.
  useLayoutEffect(() => {
    const k = kicker.current
    const t = title.current
    const c = column.current
    if (k && k.scrollWidth > k.clientWidth) console.error(`FIT: end card dateline needs ${k.scrollWidth} px of ${k.clientWidth}: "${dateline}"`)
    if (t && t.offsetHeight > titleMax) {
      console.error(`FIT: end card title needs ${t.offsetHeight} px of ${titleMax} (two lines): "${details.title}"`)
    }
    if (c && c.offsetTop + c.offsetHeight > bottom) {
      console.error(`FIT: end card ends at ${c.offsetTop + c.offsetHeight} px, past ${bottom}`)
    }
    c?.querySelectorAll<HTMLElement>("[data-fact]").forEach((v) => {
      if (v.scrollWidth > v.clientWidth) console.error(`FIT: fact "${v.dataset.fact}" needs ${v.scrollWidth} px of ${v.clientWidth}`)
    })
  }, [details.title, dateline])

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: -band.width * (1 - slide),
          top: band.top,
          width: band.width,
          height: band.height,
          borderRadius: `0 ${band.height / 2}px ${band.height / 2}px 0`,
          background: colors.primary500,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: band.textLeft,
          top: band.top,
          width: band.textWidth,
          height: band.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 14,
          color: colors.shade0,
        }}
      >
        <Rise delay={at(0)}>
          <div ref={kicker} style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden" }}>
            {dateline}
          </div>
        </Rise>
        <Rise delay={at(1)}>
          <div ref={title} style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.06 }}>
            {details.title}
          </div>
        </Rise>
      </div>
      <div ref={column} style={{ position: "absolute", left: band.textLeft, top: columnTop, width: columnWidth[platform], display: "flex", flexDirection: "column", gap: 14 }}>
        {!!details.parent && (
          <Rise delay={at(2)}>
            <Body size={24}>{details.parent}</Body>
          </Rise>
        )}
        <Rise delay={at(3)}>
          <Body size={32}>{why}</Body>
        </Rise>
        <Rise delay={at(4)}>
          <Body size={22}>{pr}</Body>
        </Rise>
        <Rise delay={at(5)} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: tileGap }}>
            {showQr && <QrTile url={details.url!} height={rows * tileHeight + (rows - 1) * tileGap} />}
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
              {details.facts.map((f) => (
                <Tile key={f.label} fact={f} dark={dark} />
              ))}
            </div>
          </div>
        </Rise>
      </div>
      <div style={{ position: "absolute", right: heroRight, top: 0, bottom: heroStrip, display: "flex", alignItems: "center" }}>
        <Rise delay={at(1)}>
          <Hero capture={hero} platform={platform} url={url} />
        </Rise>
      </div>
    </AbsoluteFill>
  )
}
