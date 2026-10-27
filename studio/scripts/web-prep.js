// Runs inside the page right before a still (cdp-shot.js sets window.vsIds from identifiers.json):
//   node scripts/cdp-shot.js 9333 <url-substr> videos/<KEY>/media/01-before.png --viewport 1350x760@2 --settle 10000 \
//     --eval "window.vsScrollY = 820; window.vsBlur = ['.account-menu']; $(cat scripts/web-prep.js)"
// Hides the known overlays that aren't the product, by name - never "everything fixed", since
// dialogs, drawers, menus and snackbars are fixed too and may be what the PR changed. Add your
// own with window.vsHide (CSS selectors). Blurs window.vsBlur's elements and every identifier the
// sticky header keeps on screen (an account menu with an email, say), scrolls to window.vsScrollY,
// then scans the text left on screen for identifiers. Prints "hidden N, other fixed N (...),
// blurred N, visible identifiers N": a new overlay in "other fixed" gets its selector into
// vsHide; any visible identifier means blur that element too or reframe, never ship it.
(() => {
  const overlays = [
    "nextjs-portal", // Next dev indicator and issues badge
    ".tsqd-open-btn-container", // TanStack Query devtools button
    "#onetrust-consent-sdk", // cookie banners
    "#CybotCookiebotDialog",
    "#usercentrics-root",
    ".cc-window",
    "#intercom-container", // chat launchers
    ".intercom-lightweight-app",
    "#hubspot-messages-iframe-container",
    "#crisp-chatbox",
    ...(window.vsHide || []),
  ]
  const style = document.createElement("style")
  style.textContent = `${overlays.join(", ")} { display: none !important; }`
  document.head.append(style)
  const hidden = document.querySelectorAll(overlays.join(", ")).length
  const otherFixed = [...document.querySelectorAll("body *")]
    .filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().width > 0)
    .map((e) => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : "") + (e.classList[0] ? `.${e.classList[0]}` : ""))
  const patterns = (window.vsIds || [{ regex: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+" }, { regex: "\\b\\d{9,}\\b" }]).map((p) => new RegExp(p.regex, "i"))
  const isId = (text) => patterns.some((p) => p.test(text))
  const textNodes = (root) => {
    const nodes = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (isId(n.textContent)) nodes.push(n)
    return nodes
  }
  const control = "button, a, [role=button], [role=combobox], select, input"
  const header = document.querySelector("header")
  const blurred = [
    ...new Set([
      ...(header ? textNodes(header).map((n) => n.parentElement.closest(control) ?? n.parentElement) : []),
      ...(window.vsBlur || []).flatMap((s) => [...document.querySelectorAll(s)]),
    ]),
  ]
  for (const e of blurred) e.style.setProperty("filter", "blur(6px)", "important")
  window.scrollTo(0, Number(window.vsScrollY || 0))
  const hits = []
  for (const n of textNodes(document.body)) {
    const el = n.parentElement
    if (blurred.some((b) => b.contains(el))) continue
    const r = el.getBoundingClientRect()
    const onScreen = r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    if (onScreen && getComputedStyle(el).visibility !== "hidden") hits.push(el.tagName)
  }
  const others = otherFixed.length ? ` (${otherFixed.join(", ")})` : ""
  const ids = hits.length ? ` (${hits.join(",")})` : ""
  return `hidden ${hidden}, other fixed ${otherFixed.length}${others}, blurred ${blurred.length}, visible identifiers ${hits.length}${ids}`
})()
