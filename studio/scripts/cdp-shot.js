#!/usr/bin/env node
// CDP screenshot of a page target picked by URL substring, in your own Chrome on a debug port:
// it grabs the real page even when a login redirect chain left another tab active.
//
// Usage:  cdp-shot.js <port> <url-substr|*> <out.png> [clipJSON] [--viewport WxH[@DPR]] [--mobile] [--settle ms] [--eval js] [--transparent]
//   port       fixed CDP debug port (9333 for clips: references/capture-web.md)
//   url-substr  substring of the target page url (e.g. "settings/billing"); "*" = first page target
//   out.png    output path
//   clipJSON   optional {"x":N,"y":N,"width":N,"height":N} for a focused crop (page-absolute, scale 2)
//   --viewport 1440x900@2   emulate a fixed viewport + device scale factor for the shot, then clear
//              it again. Without it the capture is full-page at the window's own size/DPR, so every
//              page comes out a different size — the fixed form is what clips want (one source
//              size per clip). With --viewport the shot is the viewport only
//              (captureBeyondViewport off); DPR defaults to 2.
//   --mobile   with --viewport: emulate a phone or tablet (meta viewport, overlay scrollbars), as a
//              real device renders the page - for tablet and mobile stills, e.g. 1180x820@2, 412x823@2.
//   --settle 10000   milliseconds to wait before the shot (default 500 with --viewport, 0 without).
//              A viewport change makes Next re-render at the new breakpoint and re-fetch, and the
//              shot taken 500 ms later was the pre-hydration page (header + greeting only) on one
//              dashboard; 10 s was enough there. Check the shot before trusting it.
//   --eval '<js>'    run this in the page after the settle and right before the shot (hide overlays,
//              scroll, blur an identifier); prints its return value. It runs after the viewport
//              change on purpose: that change re-renders the page and would undo earlier DOM edits.
//              identifiers.json goes in first as window.vsIds, for scripts/web-prep.js.
//   --transparent    PNG with alpha: Chrome's default background goes transparent for the shot. The
//              page's own backgrounds still paint, so clear them in --eval (html, body). For a
//              component cut out with its real shadow, to sit on a video stage.
//   node scripts/cdp-shot.js 9333 settings/billing videos/<KEY>/media/01-after.png --viewport 1350x760@2 --settle 10000 \
//     --eval "window.vsScrollY = 0; $(cat scripts/web-prep.js)"
const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const ids = fs.readFileSync(path.join(__dirname, '..', 'identifiers.json'), 'utf8')

const args = process.argv.slice(2)
let viewport = null
const vp = args.indexOf('--viewport')
if (vp !== -1) {
  const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(args[vp + 1] || '')
  if (!m) {
    console.error('--viewport wants WxH or WxH@DPR, e.g. 1440x900@2')
    process.exit(64)
  }
  viewport = { width: +m[1], height: +m[2], deviceScaleFactor: m[3] ? +m[3] : 2, mobile: false }
  args.splice(vp, 2)
}
const mob = args.indexOf('--mobile')
if (mob !== -1) {
  if (!viewport) {
    console.error('--mobile needs --viewport')
    process.exit(64)
  }
  viewport.mobile = true
  args.splice(mob, 1)
}
let settleMs = null
const st = args.indexOf('--settle')
if (st !== -1) {
  settleMs = Number(args[st + 1])
  if (!Number.isFinite(settleMs) || settleMs < 0) {
    console.error('--settle wants a millisecond count, e.g. --settle 10000')
    process.exit(64)
  }
  args.splice(st, 2)
}
const tr = args.indexOf('--transparent')
const transparent = tr !== -1
if (transparent) args.splice(tr, 1)
let evalJs = null
const ev = args.indexOf('--eval')
if (ev !== -1) {
  evalJs = args[ev + 1]
  args.splice(ev, 2)
}
const [port, substr, out, clipArg] = args
if (!port || !substr || !out) {
  console.error('usage: cdp-shot.js <port> <url-substr|*> <out.png> [clipJSON] [--viewport WxH[@DPR]] [--mobile] [--settle ms] [--eval js] [--transparent]')
  process.exit(64)
}

http.get({ host: '127.0.0.1', port, path: '/json' }, (r) => {
  let d = ''
  r.on('data', (c) => (d += c))
  r.on('end', () => {
    const all = JSON.parse(d).filter((t) => t.type === 'page')
    let ts = all.filter((t) => (t.url || '').includes(substr))
    if (!ts.length && (substr === '*' || all.length === 1)) ts = all
    if (!ts.length) {
      console.error('no page target matching ' + substr)
      process.exit(2)
    }
    const ws = new WebSocket(ts[0].webSocketDebuggerUrl)
    let id = 0
    const p = {}
    const send = (m, par = {}) =>
      new Promise((res) => {
        const i = ++id
        p[i] = res
        ws.send(JSON.stringify({ id: i, method: m, params: par }))
      })
    ws.on('message', (m) => {
      const o = JSON.parse(m)
      if (o.id && p[o.id]) {
        p[o.id](o)
        delete p[o.id]
      }
    })
    ws.on('error', (e) => {
      console.error('ws error: ' + e.message)
      process.exit(4)
    })
    ws.on('open', async () => {
      await send('Page.enable')
      if (viewport) await send('Emulation.setDeviceMetricsOverride', viewport)
      const wait = settleMs ?? (viewport ? 500 : 0) // reflow, hydration, re-fetch - see --settle above
      if (wait) await new Promise((res) => setTimeout(res, wait))
      if (evalJs) {
        const r1 = await send('Runtime.evaluate', { expression: `window.vsIds = ${ids}.patterns;\n${evalJs}`, returnByValue: true, awaitPromise: true })
        if (r1.result?.exceptionDetails) {
          console.error('eval failed: ' + r1.result.exceptionDetails.exception?.description)
          process.exit(3)
        }
        if (r1.result?.result?.value !== undefined) console.log('eval: ' + r1.result.result.value)
        await new Promise((res) => setTimeout(res, 700)) // let the page repaint after the edit
      }
      const params = { format: 'png', captureBeyondViewport: !viewport, fromSurface: true }
      if (clipArg) {
        const clip = JSON.parse(clipArg)
        clip.scale = clip.scale || 2
        params.clip = clip
      }
      if (transparent) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
      const r2 = await send('Page.captureScreenshot', params)
      if (transparent) await send('Emulation.setDefaultBackgroundColorOverride', {})
      if (viewport) await send('Emulation.clearDeviceMetricsOverride')
      fs.writeFileSync(out, Buffer.from(r2.result.data, 'base64'))
      console.log('saved ' + out + (viewport ? ` (viewport ${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}${viewport.mobile ? ' mobile' : ''})` : ''))
      ws.close()
      process.exit(0)
    })
  })
}).on('error', (e) => {
  console.error('http error: ' + e.message)
  process.exit(5)
})
