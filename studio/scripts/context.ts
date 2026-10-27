// Prints a clip's agent context: the one line of JSON render.sh writes into the share copy's comment tag.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/context.ts videos/<KEY>/props.json
import { readFileSync } from "node:fs"

import { context } from "../src/pr-clip/context.ts"

console.log(context(JSON.parse(readFileSync(process.argv[2], "utf8"))))
