import { loadFont } from "@remotion/fonts"
import { cancelRender, continueRender, delayRender } from "remotion"

import bold from "./assets/WorkSans-Bold.ttf"
import extraBold from "./assets/WorkSans-ExtraBold.ttf"
import regular from "./assets/WorkSans-Regular.ttf"
import semiBold from "./assets/WorkSans-SemiBold.ttf"
import * as brand from "./brand"

/**
 * Work Sans (SIL OFL 1.1, see assets/OFL.txt), imported through the bundler. Not staticFile: every video brings its own public
 * dir (--public-dir=videos/<KEY>/media), so a font kept in one would be missing
 * from all the others. Import this module once, in Root.
 */
const handle = delayRender("Loading Work Sans")

const { weights } = brand.type
const faces = [
  { url: regular, weight: weights.regular },
  { url: semiBold, weight: weights.semiBold },
  { url: bold, weight: weights.bold },
  { url: extraBold, weight: weights.extraBold },
]

Promise.all(
  faces.map(({ url, weight }) =>
    loadFont({ family: brand.type.family, url, weight: String(weight) }),
  ),
)
  .then(() => continueRender(handle))
  .catch((err) => cancelRender(err))
