import { loadFont } from "@remotion/fonts"
import { cancelRender, continueRender, delayRender } from "remotion"

import latinExt from "./assets/SchibstedGrotesk-latin-ext.woff2"
import latin from "./assets/SchibstedGrotesk-latin.woff2"
import * as brand from "./brand"

/**
 * Schibsted Grotesk (SIL OFL 1.1, see assets/OFL.txt), the variable font (weights 400–900) in its
 * latin and latin-ext subsets, imported through the bundler. Not staticFile: every video brings its
 * own public dir (--public-dir=videos/<KEY>/media), so a font kept in one would be missing from all
 * the others. Import this module once, in Root.
 */
const handle = delayRender("Loading Schibsted Grotesk")

// The unicode ranges are the subsets' own, from the Google Fonts CSS they came with.
const faces = [
  {
    url: latin,
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    url: latinExt,
    unicodeRange:
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
]

Promise.all(faces.map(({ url, unicodeRange }) => loadFont({ family: brand.type.family, url, weight: "400 900", unicodeRange })))
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err))
