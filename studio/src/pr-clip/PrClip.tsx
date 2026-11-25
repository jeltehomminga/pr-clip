import React from "react"
import { Audio, Sequence, staticFile } from "remotion"

import { Beat } from "../components/Beat"
import { Caption } from "../components/Caption"
import { Stage } from "../components/Stage"
import { AppPair } from "./AppPair"
import { cardLands, EndCard } from "./EndCard"
import { Outro } from "./Outro"
import { Progress } from "./Progress"
import { sounds } from "./sounds"
import { crossfade, focusOf, timeline, wipeFastest, type PrClipProps } from "./timeline"
import { Variants } from "./Variants"
import { WebWipe } from "./WebWipe"

/**
 * A PR before/after clip, laid out by timeline(): the first pair is on screen
 * from frame 0 with the why as its first caption (result first), one beat per
 * pair, one per group of variants, then the details end card (or just the ticket
 * key). A tick marks each fix bracket, a whoosh each wipe (peaking on its fastest frame), a
 * snap the details card's title landing (sounds.ts).
 */
export const PrClip: React.FC<PrClipProps> = (props) => {
  const t = timeline(props)
  const last = t.beats.length - 1
  const cues = t.beats.flatMap((beat): { role: keyof typeof sounds; at: number }[] => {
    if (beat.kind === "pair" && beat.wipeAt !== undefined) return [{ role: "whoosh", at: beat.from + beat.wipeAt + wipeFastest }]
    // The tick lands with the first fix ring, which may wait for a recording to reach its end state.
    if (beat.kind === "pair") return [{ role: "tick", at: beat.from + beat.afterRingsAt + (props.pairs[beat.index].after.rings?.[0]?.delay ?? 0) }]
    if (beat.kind === "variants") return [{ role: "tick", at: beat.from + beat.ringsAt }]
    if (beat.kind === "outro" && props.details) return [{ role: "snap", at: beat.from + cardLands }]
    return []
  }).filter((cue) => sounds[cue.role].length > 0)

  return (
    <Stage>
      {t.beats.map((beat, i) => {
        const duration = beat.duration + (i === last ? 0 : crossfade)

        return (
          <Sequence key={`${beat.kind}-${beat.from}`} from={beat.from} durationInFrames={duration}>
            <Beat
              durationInFrames={duration}
              fadeIn={i === 0 ? 0 : crossfade}
              fadeOut={i === last ? 0 : crossfade}
              tilt={beat.kind !== "outro"}
            >
              {beat.kind === "outro" &&
                (props.details ? (
                  <EndCard
                    issueKey={props.issueKey}
                    why={props.why}
                    prNumber={props.pr?.number}
                    details={props.details}
                    hero={props.pairs[0].after}
                    platform={props.platform}
                    url={props.pairs[0].url ?? props.url}
                    captured={props.capture?.date}
                    qr={props.qr !== false}
                  />
                ) : (
                  <Outro text={beat.text} issueKey={props.issueKey} />
                ))}
              {beat.kind === "pair" && props.platform === "app" && <AppPair pair={props.pairs[beat.index]} beat={beat} focus={focusOf(props)} />}
              {beat.kind === "pair" && props.platform === "web" && (
                // The focus mark only where a lean-in follows and takes over the pointing.
                <WebWipe
                  pair={props.pairs[beat.index]}
                  beat={beat}
                  url={props.pairs[beat.index].url ?? props.url}
                  zoomTo={focusOf(props).zoom}
                  mark={beat.zoomAt === undefined ? undefined : focusOf(props).mark}
                />
              )}
              {beat.kind === "variants" && (
                <Variants group={props.variants![beat.index]} beat={beat} platform={props.platform} url={props.url} />
              )}
            </Beat>
          </Sequence>
        )
      })}
      <Progress beats={t.beats} />
      <Caption cues={t.cues} />
      {/* Each caption read aloud, no music: music never cut to the beat, and it had to duck under the voice. */}
      {t.lines.map((line) => {
        const file = props.voice?.[line.id]?.file
        return (
          file && (
            <Sequence key={`vo-${line.id}`} from={line.from} layout="none">
              <Audio src={staticFile(file)} />
            </Sequence>
          )
        )
      })}
      {cues.map((cue, i) => {
        // The n-th cue of a role plays its n-th take, round robin, so a repeated sound never repeats its sample.
        const takes = sounds[cue.role]
        const take = takes[cues.slice(0, i).filter((c) => c.role === cue.role).length % takes.length]
        return (
          <Sequence key={`sound-${cue.at}`} from={cue.at - take.lead}>
            <Audio src={take.src} volume={take.volume} />
          </Sequence>
        )
      })}
    </Stage>
  )
}
