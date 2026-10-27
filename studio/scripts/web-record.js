#!/usr/bin/env node
// Records a web page load or interaction as a real-time 30 fps mp4 for a web pair: a web clip
// must show the transition itself, not two stills.
//
//   node scripts/web-record.js \
//     9333 localhost videos/<KEY>/media/01-before.mp4 --viewport 1350x760@2 --seconds 8 \
//     [--prep scripts/web-prep-live.js] [--reload] [--mobile]
//
// Frames come from Page.startScreencast WITH their timestamps. Screencast only emits on a repaint,
// so a static state is one or two frames: played at a fixed rate it flashes by. Here every frame is held until the next frame's
// timestamp, and the last one until the stop, so a state stays on screen exactly as long as it did
// in the browser. ffmpeg then resamples that to constant 30 fps.
//
// --prep injects a script on every new document (overlays hidden, identifiers blurred before the
// first paint), after window.vsIds from identifiers.json, and runs it once on the page as it is. --reload reloads the page once the
// screencast runs, which is how a widget that loads with the page is filmed. Trim the white reload
// frames with trimBefore (frame-probe.js).
//
// --mobile films a phone or tablet: mobile layout plus touch input, so Input.dispatchTouchEvent from
// a driver reaches the page as touch. The override lives in this script's own CDP session: one set
// from another session ends when that session closes and flips the layout back mid-take.
// The page re-lays out when the take starts, so filming waits 1 s for it; drive the page (scroll,
// prep, gestures) from another session after that.
const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const [, value] = args.splice(i, 2)
  return value
}
const bool = (name) => {
  const i = args.indexOf(name)
  if (i === -1) return false
  args.splice(i, 1)
  return true
}
const vp = /^(\d+)x(\d+)@([\d.]+)$/.exec(flag('--viewport') || '1350x760@2')
const seconds = Number(flag('--seconds') || 8)
const prep = flag('--prep')
const reload = bool('--reload')
const mobile = bool('--mobile')
const [port, substr, out] = args
if (!port || !substr || !out || !vp || !(seconds > 0)) {
  console.error('usage: web-record.js <port> <url-substr> <out.mp4> [--viewport WxH@DPR] [--seconds N] [--prep file.js] [--reload] [--mobile]')
  process.exit(64)
}
const [width, height, dpr] = [+vp[1], +vp[2], +vp[3]]
const framesDir = `${out}.frames`
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const encode = (frames, stopAt) => {
  if (!frames.length) {
    console.error('no frames')
    return 3
  }
  // Output frame k shows whatever was on screen at t0 + k/30: the last screencast frame at or
  // before that moment, hard-linked into a plain 30 fps sequence. (ffmpeg's concat demuxer
  // stretched image durations under 40 ms: a 7 s take came out 11.3 s.)
  const total = Math.round((stopAt - frames[0].t) * 30)
  let src = 0
  for (let k = 0; k < total; k++) {
    const at = frames[0].t + k / 30
    while (src + 1 < frames.length && frames[src + 1].t <= at) src++
    fs.linkSync(path.join(framesDir, frames[src].file), path.join(framesDir, `o${String(k).padStart(5, '0')}.png`))
  }
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(framesDir, 'o%05d.png'),
      '-vf', `scale=${width * dpr}:${height * dpr}:flags=lanczos,format=yuv420p`,
      '-r', '30', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  )
  if (r.status !== 0) {
    console.error(`ffmpeg failed; frames kept in ${framesDir}`)
    return 6
  }
  if (!process.env.KEEP_FRAMES) fs.rmSync(framesDir, { recursive: true, force: true })
  console.log(`${out}: ${frames.length} screencast frames over ${(stopAt - frames[0].t).toFixed(2)} s -> 30 fps`)
  return 0
}

http
  .get({ host: '127.0.0.1', port, path: '/json' }, (r) => {
    let d = ''
    r.on('data', (c) => (d += c))
    r.on('end', () => {
      const target = JSON.parse(d).find((t) => t.type === 'page' && (t.url || '').includes(substr))
      if (!target) {
        console.error('no page target matching ' + substr)
        process.exit(2)
      }
      const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false })
      let id = 0
      const pending = new Map()
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          const i = ++id
          pending.set(i, resolve)
          ws.send(JSON.stringify({ id: i, method, params }))
        })
      const frames = []
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw)
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg)
          pending.delete(msg.id)
          return
        }
        if (msg.method !== 'Page.screencastFrame') return
        const { data, metadata, sessionId } = msg.params
        const file = `f${String(frames.length).padStart(5, '0')}.png`
        fs.writeFileSync(path.join(framesDir, file), Buffer.from(data, 'base64'))
        frames.push({ file, t: metadata.timestamp })
        send('Page.screencastFrameAck', { sessionId })
      })
      ws.on('open', async () => {
        await send('Page.enable')
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile })
        if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
        const ids = fs.readFileSync(path.join(__dirname, '..', 'identifiers.json'), 'utf8')
        const source = prep && `window.vsIds = ${ids}.patterns;\n${fs.readFileSync(prep, 'utf8')}`
        const script = source && (await send('Page.addScriptToEvaluateOnNewDocument', { source }))
        if (source) await send('Runtime.evaluate', { expression: source })
        if (mobile) await new Promise((r) => setTimeout(r, 1000))
        const start = { format: 'png', maxWidth: width * dpr, maxHeight: height * dpr, everyNthFrame: 1 }
        await send('Page.startScreencast', start)
        // A navigation can end the screencast; restarting it is harmless when it still runs.
        if (reload) {
          await send('Page.reload', {})
          setTimeout(() => send('Page.startScreencast', start), 300)
        }
        setTimeout(async () => {
          const stopAt = Date.now() / 1000
          await send('Page.stopScreencast')
          if (script?.result?.identifier) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.result.identifier })
          await send('Emulation.clearDeviceMetricsOverride')
          if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: false })
          ws.close()
          process.exit(encode(frames, stopAt))
        }, seconds * 1000)
      })
    })
  })
  .on('error', (e) => {
    console.error('http error: ' + e.message)
    process.exit(5)
  })
