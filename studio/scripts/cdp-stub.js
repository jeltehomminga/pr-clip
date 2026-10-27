#!/usr/bin/env node
// Answer one API route with a fixed JSON body in a Chrome tab, so before and after see the
// same data when the test environment can't produce the state a PR is about.
//
//   node scripts/cdp-stub.js <port> <url-substr> <urlPattern> <body.json> [--status <code> | --merge] [--method <M>]
//   e.g. node scripts/cdp-stub.js 9333 billing '*/api/mandates*' videos/<KEY>/stub-mandates.json
//        node scripts/cdp-stub.js 9333 billing '*/api/payments*' videos/<KEY>/stub-error.json --status 500 --method POST
//        node scripts/cdp-stub.js 9333 settings '*/api/features*' videos/<KEY>/stub-flag.json --merge
//
// Picks the page target by url substring, intercepts requests matching urlPattern (CDP
// Fetch, `*` wildcards), fulfils each with 200 + the body, reloads the page and keeps
// answering until stopped (Ctrl-C / kill), so a capture can run alongside it. Only XHR/fetch
// from the browser is reachable: data the Next server fetches during SSR never passes here.
//   --status <code>  answer with that status instead of 200, for error states.
//   --method <M>     answer only that method; other methods reach the server untouched.
//   --merge          let the request through and shallow-merge the body over the real JSON
//                    answer, keeping its status: {"canEdit": true} turns one flag on.
//                    A non-2xx or non-JSON answer passes untouched.
// Note the stub in the clip's review.md - the box it shows is real UI on stubbed data.
const http = require("http")
const fs = require("fs")
const { parseArgs } = require("util")
const WebSocket = require("ws")

const usage = "usage: cdp-stub.js <port> <url-substr> <urlPattern> <body.json> [--status <code> | --merge] [--method <M>]"
let args
try {
  args = parseArgs({
    allowPositionals: true,
    options: { status: { type: "string" }, method: { type: "string" }, merge: { type: "boolean" } },
  })
} catch (e) {
  console.error(e.message + "\n" + usage)
  process.exit(64)
}
const [port, substr, urlPattern, bodyFile] = args.positionals
const { merge } = args.values
const status = Number(args.values.status ?? 200)
const onlyMethod = args.values.method?.toUpperCase()
if (!port || !substr || !urlPattern || !bodyFile || !/^[2-5]\d\d$/.test(status) || (merge && args.values.status)) {
  console.error(usage)
  process.exit(64)
}
const body = JSON.parse(fs.readFileSync(bodyFile, "utf8"))
const base64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64")
const json = [{ name: "Content-Type", value: "application/json" }]

http
  .get({ host: "127.0.0.1", port, path: "/json" }, (r) => {
    let d = ""
    r.on("data", (c) => (d += c))
    r.on("end", () => {
      const target = JSON.parse(d).find((t) => t.type === "page" && (t.url || "").includes(substr))
      if (!target) {
        console.error("no page target matching " + substr)
        process.exit(2)
      }
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      let id = 0
      const pending = new Map()
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          pending.set(++id, resolve)
          ws.send(JSON.stringify({ id, method, params }))
        })
      ws.on("open", () => {
        // --merge needs the real answer, so it pauses at the Response stage
        send("Fetch.enable", { patterns: [{ urlPattern, requestStage: merge ? "Response" : "Request" }] })
        send("Page.reload", { ignoreCache: true })
        const page = target.url.replace(/[?#].*/, "")
        console.log(`stubbing ${onlyMethod ? onlyMethod + " " : ""}${urlPattern} (${merge ? "merge" : status}) on ${page}`)
      })
      ws.on("message", async (m) => {
        const o = JSON.parse(m)
        if (pending.has(o.id)) {
          pending.get(o.id)(o.result)
          pending.delete(o.id)
          return
        }
        if (o.method !== "Fetch.requestPaused") return
        const { requestId, request, responseStatusCode: code } = o.params
        const where = request.method + " " + request.url.replace(/^https?:\/\/[^/]+/, "").replace(/[?].*/, "")
        const pass = (why = "") => {
          send(merge ? "Fetch.continueResponse" : "Fetch.continueRequest", { requestId })
          console.log("passed " + where + why)
        }
        if (onlyMethod && request.method !== onlyMethod) return pass()
        if (!merge) {
          send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: json, body: base64(body) })
          return console.log("answered " + where)
        }
        if (!(code >= 200 && code < 300)) return pass(" (" + (code ?? o.params.responseErrorReason) + ")")
        let merged
        try {
          const got = await send("Fetch.getResponseBody", { requestId })
          merged = Object.assign(JSON.parse(got.base64Encoded ? Buffer.from(got.body, "base64").toString() : got.body), body)
        } catch {
          return pass(" (not JSON)")
        }
        send("Fetch.fulfillRequest", { requestId, responseCode: code, responseHeaders: json, body: base64(merged) })
        console.log("merged " + where)
      })
      ws.on("error", (e) => {
        console.error("ws error: " + e.message)
        process.exit(4)
      })
      ws.on("close", () => process.exit(0))
    })
  })
  .on("error", (e) => {
    console.error("http error: " + e.message)
    process.exit(5)
  })
