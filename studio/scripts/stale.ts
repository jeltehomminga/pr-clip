// Is a clip still showing the PR's code? Compares props.json `pr.commit` (the commit the clip was
// captured from) with the PR on GitHub. Clips are usually made before review, and review commits
// change the UI, so a posted clip can go out of date silently.
//   scripts/stale.sh            every clip with a `pr`
//   scripts/stale.sh <KEY>...   just these
// fresh:    the PR's head (or its merge) is the captured commit.
// same-ui:  the PR moved, but nothing that moved can change what the clip shows: the PR's own new
//           commits touch only files that never render, and a merge of the base branch touches none of
//           the clip's files, no file the PR changed, no translations and no dependencies.
// accepted: the user said keep it at this head: props.json `pr.accepted`.
// stale:    anything else - re-cut the beats it names, or take the posted clip down after the user's yes.
// Exit 1 when any clip is stale. Read-only: one `gh pr view` per PR and `git fetch` in pr.checkout,
// whose working tree never moves.
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { PrClipProps } from "../src/pr-clip/timeline.ts"
import { gh, run, type GhPr } from "./props.ts"

/** Files that never change what a screen shows: tests, stories, docs, CI, lint and tool config. Add your repo's own. */
const quiet = [
  /(^|\/)sonar-project\.properties$/,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)(__tests__|__mocks__|e2e|\.maestro|\.storybook|\.rnstorybook|\.github|\.circleci|\.husky|\.eas|docs|\.claude|\.cursor|\.vscode)\//,
  /\.stories\.[cm]?[jt]sx?$/,
  /\.mdx?$/,
  /(^|\/)(\.gitlab-ci\.ya?ml|mkdocs\.yml|renovate\.json|Dockerfile|CODEOWNERS|\.gitignore|\.prettierrc[^/]*|\.prettierignore|\.editorconfig)$/,
  /(^|\/)(jest|commitlint)\.[^/]*$/,
  /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc[^/]*)$/,
]
/**
 * Files that can change any screen, so a base-branch merge that touches one is never same-ui on its own:
 * translations, dependencies, app config, and the shared components, theme, hooks and utils every
 * screen draws with (state.files lists only what the PR changed, never the Card it renders in).
 * ponytail: folder patterns flag more merges than they need to; the import closure of state.files at
 * the new head is the upgrade if the user gets too many questions.
 */
const shared = [
  /(^|\/)(i18n|locales?|translations?)\//,
  /(^|\/)(package\.json|package-lock\.json|bun\.lockb?|yarn\.lock|pnpm-lock\.yaml|Podfile\.lock)$/,
  /(^|\/)app\.(json|config\.[cm]?[jt]s)$/,
  /^((src|app)\/)?(components|hooks|utils|lib|theme|themes|styles|tokens|design-tokens)\//,
  /(^|\/)(global\.css|tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|nativewind[^/]*)$/,
]
const matches = (patterns: RegExp[], file: string) => patterns.some((p) => p.test(file))
/** A `state.files` entry is a file or a directory. */
const under = (file: string, entry: string) => file === entry || file.startsWith(entry.endsWith("/") ? entry : `${entry}/`)
/** The screen a state file belongs to, its first three folders: src/screens/Home/components/X.tsx -> src/screens/Home/. */
const area = (entry: string) => entry.split("/").slice(0, -1).slice(0, 3).join("/") + "/"

/** What moved between the captured commit and the PR's head, as file lists from git. */
export type Moved = {
  /** `git diff --name-only <captured> <head>` */
  changed: string[]
  /** The PR's own new commits, merges left out. */
  own: string[]
  /** Master's changes the PR took in: old base..new base, empty when the base didn't move. */
  master: string[]
  /** The PR's diff at capture: old base..captured. */
  pr: string[]
  /** Every `state.files` in props.json; a directory ends in "/". */
  clip: string[]
}

/** The changed files that may change what the clip shows. Empty: same-ui. */
export function triage(m: Moved): string[] {
  // The clip's screens, not only the files the PR changed: master may change a header the clip shows.
  const inClip = (f: string) => m.clip.some((c) => under(f, c) || under(f, area(c)))
  const masterOnly = (f: string) => m.master.includes(f) && !m.own.includes(f) && !m.pr.includes(f)
  return m.changed.filter((f) => !matches(quiet, f) && !(masterOnly(f) && !inClip(f) && !matches(shared, f)))
}

/** The beats whose state lists one of the files: "pair 2", "variants 1 (Dark)". */
export function beatsHit(props: PrClipProps, files: string[]) {
  const hit = (list?: string[]) => !!list?.some((c) => files.some((f) => under(f, c)))
  return [
    ...props.pairs.flatMap((p, i) => (hit(p.state?.files) ? [`pair ${i + 1}`] : [])),
    ...(props.variants ?? []).flatMap((g, i) => g.captures.filter((c) => hit(c.state?.files)).map((c) => `variants ${i + 1} (${c.label})`)),
  ]
}

type Verdict = "fresh" | "same-ui" | "accepted" | "stale"

function verdict(props: PrClipProps, fetched: Set<string>): [Verdict, string] {
  const pr = props.pr
  if (!pr?.commit) return ["stale", "props.json has no pr.commit - record the captured commit"]
  if (!pr.checkout) return ["stale", "props.json has no pr.checkout - run scripts/props.ts <KEY> --checkout <your clone>"]
  const got = gh<GhPr>("pr", "view", String(pr.number), "--repo", pr.repo, "--json", "state,headRefOid,mergeCommit,baseRefName")
  // props.json keeps 12-character hashes; compare on that prefix.
  const c = pr.commit.slice(0, 12)
  const head = got.headRefOid.slice(0, 12)
  const merge = got.mergeCommit?.oid.slice(0, 12) ?? ""
  const at = `#${pr.number} ${got.state}, captured ${c}`
  if (got.state !== "OPEN" && got.state !== "MERGED") return ["stale", `${at}; the PR is closed`]
  if (c === head || (got.state === "MERGED" && c === merge)) return ["fresh", at]
  const moved = got.state === "MERGED" ? `merged at ${merge} from head ${head}` : `the PR head is now ${head}`
  if (pr.accepted?.head.slice(0, 12) === head) return ["accepted", `${at}; ${moved}: ${pr.accepted.why}`]

  const checkout = pr.checkout
  const git = (...args: string[]) => run("git", ["-C", checkout, ...args])
  if (!fetched.has(checkout)) git("fetch", "-q", "origin")
  fetched.add(checkout)
  // A merged PR's branch is gone, and its commits with it, but GitHub keeps every PR head under refs/pull/.
  if ([c, head].some((hash) => spawnSync("git", ["-C", checkout, "cat-file", "-e", `${hash}^{commit}`]).status !== 0)) {
    spawnSync("git", ["-C", checkout, "fetch", "-q", "origin", `+refs/pull/${pr.number}/head:refs/remotes/origin/pr/${pr.number}`])
  }
  // The base branch as the PR saw it: the base now, or the merge's first parent once merged.
  const dest = got.state === "MERGED" ? `${merge}^1` : `origin/${got.baseRefName}`
  const names = (...args: string[]) => [...new Set(git(...args).split("\n").filter(Boolean))]
  let m: Moved
  let sameBase: boolean
  try {
    const oldBase = pr.base ?? git("merge-base", c, dest)
    const newBase = git("merge-base", head, dest)
    sameBase = git("rev-parse", oldBase) === git("rev-parse", newBase)
    m = {
      changed: names("diff", "--name-only", c, head),
      own: names("log", "--no-merges", "--format=", "--name-only", head, "--not", c, dest),
      master: sameBase ? [] : names("diff", "--name-only", oldBase, newBase),
      pr: names("diff", "--name-only", oldBase, c),
      clip: [...props.pairs.flatMap((p) => p.state?.files ?? []), ...(props.variants ?? []).flatMap((g) => g.captures.flatMap((v) => v.state?.files ?? []))],
    }
  } catch {
    return ["stale", `${at}; ${moved}; git in ${checkout} can't compare them (a force-push?)`]
  }
  const risky = triage(m)
  if (risky.length === 0) {
    const why = [m.own.length > 0 && `PR commits touch only ${m.own.join(", ")}`, !sameBase && "base-branch merge outside the clip"].filter(Boolean).join("; ")
    return ["same-ui", `${at}; ${moved}; ${why}`]
  }
  const beats = beatsHit(props, risky)
  const shown = risky.length > 8 ? [...risky.slice(0, 8), `${risky.length - 8} more`] : risky
  return ["stale", `${at}; ${moved}; may change the UI: ${shown.join(", ")}${beats.length > 0 ? `; re-cut ${beats.join(", ")}` : ""}`]
}

function main() {
  process.chdir(fileURLToPath(new URL("..", import.meta.url)))
  const keys = process.argv.slice(2)
  const files = (keys.length > 0 ? keys : readdirSync("videos")).map((k) => `videos/${k}/props.json`).filter((f) => keys.length > 0 || existsSync(f))
  const fetched = new Set<string>()
  let bad = false
  for (const file of files) {
    if (!existsSync(file)) {
      console.log(`stale    ${file}: no props.json`)
      bad = true
      continue
    }
    const props: PrClipProps = JSON.parse(readFileSync(file, "utf8"))
    if (!props.pr) {
      if (keys.length > 0) console.log(`stale    ${props.issueKey}: props.json has no pr`)
      bad ||= keys.length > 0
      continue
    }
    const [v, detail] = verdict(props, fetched)
    console.log(`${v.padEnd(8)} ${file.split("/")[1]}: ${detail}`)
    bad ||= v === "stale"
  }
  process.exit(bad ? 1 : 0)
}

if (import.meta.main) main()
