import React from "react"
import { AbsoluteFill } from "remotion"

import { Eyebrow, Headline } from "../components/Text"

type OutroProps = { text: string; issueKey: string }

/** Last beat: the outro line (the ticket key when there is none), the key under it; the logo is the corner one (PrClip). */
export const Outro: React.FC<OutroProps> = ({ text, issueKey }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, textAlign: "center" }}>
    <Headline size={60}>{text}</Headline>
    {text !== issueKey && <Eyebrow>{issueKey}</Eyebrow>}
  </AbsoluteFill>
)
