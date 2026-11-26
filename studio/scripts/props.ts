// Fills the parts of a clip's props.json that need no judgement: the facts from GitHub and git, and
// the measurements of the files in media/.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/props.ts <KEY> [--pr <owner/repo>#<number>] [--checkout <dir>]
// Run it at step 1 for the facts (it creates props.json) and again after the captures.
// - Facts (pr.commit, pr.base, details) are filled only when missing: delete one to fetch it again.
// - Measurements (width, height, platform, the recordings' hold stills) are taken on every run.
// - --checkout is your clone of the repo (default: the directory you run it from); it is kept as
//   pr.checkout for stale.ts. Scripts only `git fetch` in it: its working tree never moves.
// The why, captions, labels, brackets, trims, state, capture and notShown stay the agent's: a diff
// box and a trim rule both missed on real clips, so brackets and trims are measured by hand
// (measure-bounds.js, frame-probe.js). Read-only on the network: `gh pr view`, `gh issue view`, `git fetch`.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { day, isVideo, type Capture, type Details, type Fact, type PrClipProps } from "../src/pr-clip/timeline.ts"

/** The fields props.ts and stale.ts read from `gh pr view --json`. */
export type GhPr = {
  number: number
  state: "OPEN" | "MERGED" | "CLOSED"
  title: string
  url: string
  author: { login: string; name?: string }
  headRefOid: string
  baseRefName: string
  mergeCommit?: { oid: string } | null
  mergedAt?: string | null
  reviews?: { author: { login: string } | null; state: string }[]
  milestone?: { title: string } | null
  closingIssuesReferences?: { url: string }[]
}
export const prFields = "number,state,title,url,author,headRefOid,baseRefName,mergeCommit,mergedAt,reviews,milestone,closingIssuesReferences"
/** The issue the PR closes, if any: its title heads the end card and the QR opens it. */
export type GhIssue = { number: number; title: string; url: string }
/** Once merged: the merge date and the tags that contain the merge, earliest version first. */
export type Merged = { on: string; tags: { name: string; on: string }[] }

/** A title without its conventional-commit prefix, starting upper case: "fix(cart): empty total" -> "Empty total". */
export function plainTitle(title: string) {
  const plain = title.trim().replace(/^\w+(\([^)]*\))?!?:\s*/, "")
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

/**
 * The end card (studio CLAUDE.md, details card). Only facts that stay true once the clip is posted:
 * before the merge just the Developer, since status and reviewers change while the PR is open.
 * After: Developer, Reviewers, Merged, and the first stable tag as Release, else the first tag as
 * First build. Screen and Captured are the agent's.
 */
export function details(pr: GhPr, issue?: GhIssue, merged?: Merged): Details {
  const facts: Fact[] = [{ label: "Developer", value: pr.author.name || pr.author.login }]
  if (merged) {
    const approved = (pr.reviews ?? []).filter((r) => r.state === "APPROVED" && r.author).map((r) => r.author!.login)
    const reviewers = [...new Set(approved)].join(", ")
    if (reviewers) facts.push({ label: "Reviewers", value: reviewers })
    facts.push({ label: "Merged", value: day(merged.on) })
    const release = merged.tags.find((t) => /^v?\d+\.\d+\.\d+$/.test(t.name))
    const first = merged.tags[0]
    if (release) facts.push({ label: "Release", value: `${release.name.replace(/^v/, "")} (${day(release.on)})` })
    else if (first) facts.push({ label: "First build", value: first.name.replace(/^v/, "") })
  }
  return {
    kind: /^fix\b/.test(pr.title) ? "Bug fix" : "Feature",
    title: plainTitle(issue?.title ?? pr.title),
    prTitle: pr.title,
    ...(pr.milestone?.title ? { sprint: pr.milestone.title } : {}),
    url: issue?.url ?? pr.url,
    facts,
  }
}

type Draft = Partial<PrClipProps> & { issueKey: string }
type Stream = { width: number; height: number; r_frame_rate: string }

const usage = "usage: scripts/props.ts <KEY> [--pr <owner/repo>#<number>] [--checkout <dir>]"
export const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
export const run = (cmd: string, args: string[], input?: string) => execFileSync(cmd, args, { encoding: "utf8", input }).trim()
/** A read-only `gh` call that answers JSON. */
export const gh = <T>(...args: string[]): T => JSON.parse(run("gh", args))

function main() {
  const [key, ...rest] = process.argv.slice(2)
  const flags = new Map<string, string>()
  for (let i = 0; i < rest.length; i += 2) {
    if (!["--pr", "--checkout"].includes(rest[i]) || rest[i + 1] === undefined) fail(usage)
    flags.set(rest[i], rest[i + 1])
  }
  if (!key) fail(usage)
  const prArg = flags.get("--pr")
  // Before the chdir: a relative --checkout, or none, means the directory it was run from.
  const checkoutArg = resolve(flags.get("--checkout") ?? ".")
  process.chdir(fileURLToPath(new URL("..", import.meta.url)))
  const dir = `videos/${key}`
  const file = `${dir}/props.json`
  const props: Draft = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { issueKey: key }
  // Written back only when the content changed, so a file nothing fills keeps its own layout.
  const read = existsSync(file) ? JSON.stringify(props) : undefined
  const changed = new Set<string>()
  const put = <T extends object, K extends keyof T>(target: T, field: K, value: T[K], where: string) => {
    const was = JSON.stringify(target[field])
    if (was !== JSON.stringify(value)) changed.add(`${where}${String(field)} ${JSON.stringify(value)}${was ? ` (was ${was})` : ""}`)
    target[field] = value
  }

  if (prArg) {
    const [, repo, number] = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(prArg) ?? fail(usage)
    if (props.pr && (props.pr.repo !== repo || props.pr.number !== Number(number))) fail(`props.json has ${props.pr.repo}#${props.pr.number}, not ${prArg}`)
    props.pr ??= { repo, number: Number(number) }
  }

  const { pr } = props
  if (pr && !pr.checkout) {
    if (!existsSync(`${checkoutArg}/.git`)) fail(`${checkoutArg} is not a git checkout: pass --checkout <your clone of ${pr.repo}>`)
    put(pr, "checkout", checkoutArg, "pr.")
  }
  if (pr && (!pr.commit || !pr.base || !props.details)) {
    const got = gh<GhPr>("pr", "view", String(pr.number), "--repo", pr.repo, "--json", prFields)
    const merged = got.state === "MERGED"
    if (!merged && got.state !== "OPEN") fail(`${pr.repo}#${pr.number} is ${got.state}: no clip of a closed PR`)
    const git = (...args: string[]) => run("git", ["-C", pr.checkout!, ...args])
    // Open: after is the head, before its merge-base with the base branch. Merged: the merge commit and its parent.
    // shortcut: a rebase merge has no merge commit of its own, so ^1 is wrong there; set pr.base by hand
    // to <merge>~<number of PR commits> (references/worktrees.md).
    const after = merged ? (got.mergeCommit?.oid ?? fail(`${pr.repo}#${pr.number} is merged but has no merge commit`)) : got.headRefOid
    git("fetch", "-q", "origin")
    try {
      git("cat-file", "-e", `${after}^{commit}`)
    } catch {
      // A PR from a fork: its head is on none of origin's branches, but GitHub keeps it under refs/pull/.
      git("fetch", "-q", "origin", `+refs/pull/${pr.number}/head:refs/remotes/origin/pr/${pr.number}`)
    }
    if (!pr.commit) put(pr, "commit", after.slice(0, 12), "pr.")
    if (!pr.base) put(pr, "base", (merged ? git("rev-parse", `${after}^1`) : git("merge-base", after, `origin/${got.baseRefName}`)).slice(0, 12), "pr.")
    if (!props.details) {
      const closes = got.closingIssuesReferences?.[0]?.url
      const issue = closes ? gh<GhIssue>("issue", "view", closes, "--json", "number,title,url") : undefined
      const tags = () =>
        git("for-each-ref", "--contains", after, "--sort=v:refname", "--format=%(refname:short) %(creatordate:short)", "refs/tags")
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [name, on] = line.split(" ")
            return { name, on }
          })
      const facts = merged ? { on: got.mergedAt ?? git("log", "-1", "--format=%cs", after), tags: tags() } : undefined
      put(props, "details", details(got, issue, facts), "")
    }
  }

  if (props.pairs) {
    const media = `${dir}/media`
    const captures: Capture[] = [...props.pairs.flatMap((p) => [p.before, p.after]), ...(props.variants ?? []).flatMap((v) => v.captures)]
    const used = new Set(captures.map((c) => c.file))
    const missing = [...used].filter((f) => !existsSync(`${media}/${f}`))
    if (missing.length > 0) fail(`not in ${media}: ${missing.join(", ")}`)
    const probed = new Map<string, Stream>()
    const trims = new Map<string, string>()
    const todo = new Set<string>()
    for (const c of captures) {
      const stream: Stream =
        probed.get(c.file) ??
        JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", `${media}/${c.file}`])).streams[0]
      probed.set(c.file, stream)
      const size = `${stream.width}×${stream.height}`
      const was = c.width && `${c.width}×${c.height}`
      if (was !== size) changed.add(`${c.file} ${size}${was ? ` (was ${was})` : ""}`)
      c.width = stream.width
      c.height = stream.height
      if (!isVideo(c)) continue
      // Trims and holds count frames, and the clip runs at 30 fps.
      if (stream.r_frame_rate !== "30/1") fail(`${c.file} runs at ${stream.r_frame_rate}, not 30/1`)
      if (c.trimAfter === undefined) {
        todo.add(`${c.file}: pick trims with frame-probe.js, then run again`)
        continue
      }
      // The holds are named after the clip, so one clip can only have one pair of trims.
      const range = `${c.trimBefore ?? 0} ${c.trimAfter}`
      if (trims.has(c.file) && trims.get(c.file) !== range) fail(`${c.file} has two trims (${trims.get(c.file)} and ${range}); its holds would clash`)
      if (!trims.has(c.file)) console.log(run("scripts/extract-holds.sh", [key, c.file, ...range.split(" ")]).split("\n")[0])
      trims.set(c.file, range)
    }
    // From the pairs only: the web Mobile variant is portrait too. Shape, not file type: web pairs
    // can be recordings (web-record.js), and they are landscape. Every pair, not any: a web clip
    // may hold one phone-view pair (a dialog at 412 px).
    const pairCaptures = props.pairs.flatMap((p) => [p.before, p.after])
    put(props, "platform", pairCaptures.every((c) => c.height > c.width) ? "app" : "web", "")
    const unused = readdirSync(media).filter((f) => /\.(png|mp4|mov|webm)$/i.test(f) && !/-(first|last)\.png$/.test(f) && !used.has(f))
    if (unused.length > 0) todo.add(`not in props.json: ${unused.join(", ")}`)
    for (const line of todo) console.log(line)
  }

  mkdirSync(dir, { recursive: true })
  if (JSON.stringify(props) !== read) writeFileSync(file, JSON.stringify(props, null, 2) + "\n")
  console.log(changed.size > 0 ? [...changed].join("\n") : `${file}: nothing changed`)
}

if (import.meta.main) main()
