// npm test: which moved files stale.ts lets pass, on cases shaped like real review commits and base-branch merges.
import assert from "node:assert/strict"

import type { PrClipProps } from "../src/pr-clip/timeline.ts"
import { beatsHit, triage, type Moved } from "./stale.ts"

let checks = 0
const check = (name: string, fn: () => void) => {
  fn()
  checks++
}

const clip = ["src/screens/Home/components/DraggableSlot.tsx", "src/screens/Home/"]
const moved = (over: Partial<Moved>): Moved => ({ changed: [], own: [], master: [], pr: ["src/screens/Home/index.tsx"], clip, ...over })

check("a Sonar-only commit is same-ui", () => {
  assert.deepEqual(triage(moved({ changed: ["sonar-project.properties"], own: ["sonar-project.properties"] })), [])
})

check("tests, stories, docs and CI never render", () => {
  const files = ["src/screens/Home/Home.test.tsx", "src/x/__tests__/a.ts", "src/x/Card.stories.tsx", "README.md", ".github/workflows/pr.yml", "jest.config.js"]
  assert.deepEqual(triage(moved({ changed: files, own: files })), [])
})

check("the PR's own code change is stale, whatever the clip lists", () => {
  const files = ["src/screens/Home/index.tsx", "src/components/Button.tsx"]
  assert.deepEqual(triage(moved({ changed: files, own: files })), files)
})

check("a master merge outside the clip is same-ui", () => {
  const files = ["src/screens/Consumption/Graph.tsx", "src/screens/Profile/Version.tsx"]
  assert.deepEqual(triage(moved({ changed: files, master: files })), [])
})

check("a master merge that touches the clip, a file the PR changed, translations or dependencies is stale", () => {
  const files = ["src/screens/Home/Header.tsx", "src/screens/Home/index.tsx", "src/screens/Advances/locale/de.json", "app/i18n/locales/fr/common.json", "bun.lock", "package.json", "app.config.js"]
  assert.deepEqual(triage(moved({ changed: files, master: files })), files)
})

check("a master merge that restyles a shared component, theme or hook, or another file of the clip's screen, is stale", () => {
  const files = ["src/components/Card/Card.tsx", "app/components/Button.tsx", "src/hooks/useFormattedInput/index.ts", "src/theme/colors.ts", "global.css", "src/screens/Home/components/Header.tsx"]
  assert.deepEqual(triage(moved({ changed: files, master: files })), files)
})

check("another screen's own components folder is not shared", () => {
  assert.deepEqual(triage(moved({ changed: ["src/screens/Consumption/components/Graph.tsx"], master: ["src/screens/Consumption/components/Graph.tsx"] })), [])
})

check("a PR commit on a file master also changed is stale, even outside the clip", () => {
  assert.deepEqual(triage(moved({ changed: ["src/utils/format.ts"], own: ["src/utils/format.ts"], master: ["src/utils/format.ts"] })), ["src/utils/format.ts"])
})

check("beatsHit names the pairs and variants whose state lists a file", () => {
  const state = (files: string[]) => ({ files, reach: "real staging data" })
  const capture = { file: "a.png", width: 1, height: 1 }
  const props = {
    pairs: [
      { before: capture, after: capture, caption: "", state: state(["src/a.tsx"]) },
      { before: capture, after: capture, caption: "", state: state(["src/b/"]) },
    ],
    variants: [{ caption: "", captures: [{ ...capture, label: "Dark", state: state(["src/b/c.tsx"]) }] }],
  } as unknown as PrClipProps
  assert.deepEqual(beatsHit(props, ["src/b/c.tsx"]), ["pair 2", "variants 1 (Dark)"])
})

console.log(`stale: ${checks} checks passed`)
