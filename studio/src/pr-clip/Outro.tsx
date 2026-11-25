import React from "react"
import { AbsoluteFill } from "remotion"

import { Eyebrow, Headline, Rise, Words } from "../components/Text"
import { crossfade } from "./timeline"

type OutroProps = { text: string; issueKey: string }

/** Last beat without details: the outro line (the ticket key when there is none) rising word by word, the key under it. */
export const Outro: React.FC<OutroProps> = ({ text, issueKey }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36, textAlign: "center" }}>
    <Headline size={60}>
      <Words text={text} at={crossfade} mask />
    </Headline>
    {text !== issueKey && (
      <Rise delay={crossfade + 8}>
        <Eyebrow>{issueKey}</Eyebrow>
      </Rise>
    )}
  </AbsoluteFill>
)
