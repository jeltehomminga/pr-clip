// npm test: the end card props.ts writes, on fixtures shaped like `gh pr view --json` answers.
import assert from "node:assert/strict"

import { details, plainTitle, type GhPr } from "./props.ts"

let checks = 0
const check = (name: string, fn: () => void) => {
  fn()
  checks++
}

const pr = (over: Partial<GhPr> = {}): GhPr => ({
  number: 42,
  state: "OPEN",
  title: "feat(cart): a widget",
  url: "https://github.com/acme/shop/pull/42",
  author: { login: "ada", name: "Ada Lovelace" },
  headRefOid: "a".repeat(40),
  baseRefName: "main",
  reviews: [
    { author: { login: "grace" }, state: "COMMENTED" },
    { author: { login: "linus" }, state: "APPROVED" },
  ],
  ...over,
})

check("open PR: only the developer, since status and reviewers change before the merge", () => {
  const d = details(pr())
  assert.equal(d.kind, "Feature")
  assert.equal(d.title, "A widget")
  assert.equal(d.url, "https://github.com/acme/shop/pull/42")
  assert.equal("sprint" in d, false)
  assert.deepEqual(d.facts, [{ label: "Developer", value: "Ada Lovelace" }])
  assert.equal(details(pr({ author: { login: "ada" } })).facts[0].value, "ada")
})

check("plain titles: the conventional prefix goes, the first letter goes up", () => {
  assert.equal(plainTitle("fix(cart)!: empty total"), "Empty total")
  assert.equal(plainTitle("chore: bump"), "Bump")
  assert.equal(plainTitle("Show the total"), "Show the total")
})

check("merged fix: approvers once each, the first stable tag is the release, the closed issue titles the card", () => {
  const d = details(
    pr({
      state: "MERGED",
      title: "fix(cart): show the total below the items",
      reviews: [
        { author: { login: "linus" }, state: "APPROVED" },
        { author: { login: "grace" }, state: "APPROVED" },
        { author: { login: "linus" }, state: "APPROVED" },
        { author: null, state: "APPROVED" },
      ],
      milestone: { title: "Sprint 7" },
    }),
    { number: 7, title: "the total overlaps the items on small screens", url: "https://github.com/acme/shop/issues/7" },
    {
      on: "2026-09-30",
      tags: [
        { name: "v10.16.2-alpha.24", on: "2026-09-30" },
        { name: "v10.17.0", on: "2026-10-01" },
        { name: "v10.17.1-alpha.0", on: "2026-10-02" },
      ],
    },
  )
  assert.equal(d.kind, "Bug fix")
  assert.equal(d.title, "The total overlaps the items on small screens")
  assert.equal(d.prTitle, "fix(cart): show the total below the items")
  assert.equal(d.url, "https://github.com/acme/shop/issues/7")
  assert.equal(d.sprint, "Sprint 7")
  assert.deepEqual(d.facts, [
    { label: "Developer", value: "Ada Lovelace" },
    { label: "Reviewers", value: "linus, grace" },
    { label: "Merged", value: "30 Sep 2026" },
    { label: "Release", value: "10.17.0 (1 Oct 2026)" },
  ])
})

check("merged without a stable tag: the first tag is the first build; untagged leaves it off", () => {
  const merged = pr({ state: "MERGED" })
  const d = details(merged, undefined, { on: "2026-10-08T09:00:00Z", tags: [{ name: "v0.0.4-alpha.161", on: "2026-10-08" }] })
  assert.deepEqual(d.facts.slice(1), [
    { label: "Reviewers", value: "linus" },
    { label: "Merged", value: "8 Oct 2026" },
    { label: "First build", value: "0.0.4-alpha.161" },
  ])
  const untagged = details(merged, undefined, { on: "2026-10-08", tags: [] })
  assert.deepEqual(untagged.facts.map((f) => f.label), ["Developer", "Reviewers", "Merged"])
})

console.log(`props: ${checks} checks passed`)
