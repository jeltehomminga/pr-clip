// web-prep.js for a recording: web-record.js --prep injects this on every new document (after
// window.vsIds from identifiers.json), so the overlays are hidden and the identifiers blurred from
// the first paint, while the page loads. Same overlay list as web-prep.js. For a clip's own
// selectors, write a prep that sets them first and pass that to --prep:
//   { echo 'window.vsHide = ["#promo-bar"]; window.vsBlur = [".greeting", ".address"];'; cat scripts/web-prep-live.js; } \
//     > videos/<KEY>/capture/prep-live.js
// It re-applies every 50 ms for 20 s because React keeps adding nodes during the load.
(() => {
  const overlays = [
    "nextjs-portal",
    ".tsqd-open-btn-container",
    "#onetrust-consent-sdk",
    "#CybotCookiebotDialog",
    "#usercentrics-root",
    ".cc-window",
    "#intercom-container",
    ".intercom-lightweight-app",
    "#hubspot-messages-iframe-container",
    "#crisp-chatbox",
    ...(window.vsHide || []),
  ]
  const patterns = (window.vsIds || [{ regex: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+" }, { regex: "\\b\\d{9,}\\b" }]).map((p) => new RegExp(p.regex, "i"))
  const isId = (text) => patterns.some((p) => p.test(text))
  const control = "button, a, [role=button], [role=combobox], select, input"
  const blur = (e) => e && e.style.setProperty("filter", "blur(6px)", "important")
  const apply = () => {
    if (!document.head || !document.body) return
    if (!document.getElementById("vs-prep-live")) {
      const style = document.createElement("style")
      style.id = "vs-prep-live"
      style.textContent = `${overlays.join(", ")} { display: none !important; }`
      document.head.append(style)
    }
    const header = document.querySelector("header")
    if (header) {
      const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (isId(n.textContent)) blur(n.parentElement.closest(control) ?? n.parentElement)
    }
    for (const s of window.vsBlur || []) for (const e of document.querySelectorAll(s)) blur(e)
  }
  history.scrollRestoration = "manual"
  const timer = setInterval(apply, 50)
  setTimeout(() => clearInterval(timer), 20000)
})()
