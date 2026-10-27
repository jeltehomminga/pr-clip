import React from "react"
import { Composition } from "remotion"

import example from "../videos/EXAMPLE/props.json"
import "./fonts"
import { PrClip } from "./pr-clip/PrClip"
import { timeline, type PrClipProps } from "./pr-clip/timeline"

/**
 * EXAMPLE carries only the required fields: Remotion merges defaultProps under
 * every clip's own props (shallow), so an optional field here would leak into
 * every clip that leaves it out.
 */
const defaultProps = example as PrClipProps

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PrClip"
    component={PrClip}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({ durationInFrames: timeline(props).total })}
  />
)
