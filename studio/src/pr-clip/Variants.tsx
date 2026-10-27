import React from "react"
import { AbsoluteFill } from "remotion"

import { ring } from "../brand"
import { BrowserFrame } from "../components/BrowserFrame"
import { Highlight } from "../components/Highlight"
import { Chip } from "../components/Text"
import { PairPhone } from "./PairPhone"
import { captionFade } from "./lean"
import { pairScreen, tallScreen, type Mark, type VariantGroup, type VariantsBeat } from "./timeline"
import { Page } from "./WebWipe"

/** The pair's browser height; a row of wide windows shrinks below it to fit. */
const webMax = 700
const gap = 120
/** Composition width minus an 80 px margin on each side. */
const room = 1920 - 2 * 80
const row = { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap, paddingTop: 40 } as const

type VariantsProps = {
  group: VariantGroup
  beat: VariantsBeat
  platform: "app" | "web"
  url?: string
  /** Web: the tallest a page may stand (default 700, a pair's); a lone phone can take the full height. */
  maxScreenHeight?: number
  /** Web: how the brackets behave, as WebWipe. */
  mark?: Mark
}

/**
 * After-only variants of the fix side by side: the app in dark mode and another language, the
 * web page in another language, on a tablet and on a phone. Every frame is an after state, so
 * every chip is solid green and every ring is a fix ring. A recording plays from the rings.
 */
export const Variants: React.FC<VariantsProps> = ({ group, beat, platform, url, maxScreenHeight = webMax, mark }) => {
  if (platform === "app") {
    return (
      <AbsoluteFill style={{ ...row, ...captionFade(beat.tall ? 1 : 0) }}>
        {group.captures.map((c) => (
          <PairPhone
            key={c.label}
            capture={c}
            label={c.label}
            solid
            ringColor={ring.fix}
            ringsAt={beat.ringsAt}
            playAt={beat.ringsAt}
            screenHeight={beat.tall ? tallScreen : pairScreen}
          />
        ))}
      </AbsoluteFill>
    )
  }

  // One screen height for every window, so a tablet and a phone stand level and the row fits.
  const aspects = group.captures.reduce((sum, c) => sum + c.width / (c.height - (c.cropBottom ?? 0)), 0)
  const screenHeight = Math.min(maxScreenHeight, (room - gap * (group.captures.length - 1)) / aspects)

  return (
    <AbsoluteFill style={row}>
      {group.captures.map((c) => (
        <div key={c.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <Chip tone="solid">{c.label}</Chip>
          <BrowserFrame
            source={c}
            screenHeight={screenHeight}
            url={c.url ?? url}
            cropBottom={c.cropBottom}
            overlay={c.rings?.map((r) => (
              <Highlight
                key={`${r.left}-${r.top}-${r.width}-${r.height}`}
                rect={r}
                color={ring.fix}
                delay={beat.ringsAt + (r.delay ?? 0)}
                look={mark}
              />
            ))}
          >
            <Page capture={c} playAt={beat.ringsAt} />
          </BrowserFrame>
        </div>
      ))}
    </AbsoluteFill>
  )
}
