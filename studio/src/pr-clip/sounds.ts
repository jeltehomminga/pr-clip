import lock from "../assets/sfx/kit.lock.json"
import snap1 from "../assets/sfx/snap_1.wav"
import tick1 from "../assets/sfx/tick_1.wav"
import tick2 from "../assets/sfx/tick_2.wav"
import tick3 from "../assets/sfx/tick_3.wav"
import whoosh1 from "../assets/sfx/whoosh-short_1.wav"
import whoosh2 from "../assets/sfx/whoosh-short_2.wav"
import whoosh3 from "../assets/sfx/whoosh-short_3.wav"
import { fps, wipeFastest } from "./timeline"

/** A take, the frames from its start to its sync point, and its volume. */
export type Take = { src: string; lead: number; volume: number }
type Role = { align: "onset" | "peak"; level_db: number | null; takes: { onset_s: number; peak_s: number }[] } | null

/** Every PR clip sound at this volume, before the role's level_db. */
const volume = 0.5

/**
 * The PR clip's sounds by role, from earshot's bank (src/assets/sfx/kit.json, rendered by
 * `earshot kit render src/assets/sfx/kit.json --out src/assets/sfx`; scripts/setup-earshot.sh).
 * A sound plays `lead` frames early, so its sync point (the onset the lock measured, or a
 * whoosh's peak) lands on its cue. A role set to null in the kit is not sounded.
 * `moving`: frames between the picture starting to move and the cue (a whoosh's cue is the wipe's fastest frame).
 */
const takes = (role: string, files: string[], moving = 0): Take[] => {
  const r = (lock.roles as Record<string, Role>)[role]
  if (!r) return []
  return files.map((src, k) => {
    const t = r.takes[k]
    const lead = Math.round((r.align === "peak" ? t.peak_s : t.onset_s) * fps)
    // Research #24: a sound is noticed from 45 ms early, so it is never heard more than a frame before its picture moves.
    const heard = t.onset_s * fps - lead + moving
    if (heard < -1) throw new Error(`${role} take ${k + 1} is heard ${(-heard).toFixed(1)} frames before its picture moves (max 1)`)
    return { src, lead, volume: volume * 10 ** ((r.level_db ?? 0) / 20) }
  })
}

export const sounds = {
  tick: takes("tick", [tick1, tick2, tick3]),
  whoosh: takes("whoosh.short", [whoosh1, whoosh2, whoosh3], wipeFastest),
  snap: takes("snap", [snap1]),
}
