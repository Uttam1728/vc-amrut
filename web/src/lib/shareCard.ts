// Draws a shareable quote card (1080×1350, WhatsApp/Instagram friendly) on a canvas and returns it as a JPEG.
const W = 1080
const H = 1350
const PAD = 96
const SERIF = '"Noto Serif Gujarati Variable", serif'
const SANS = '"Geist Variable", "Noto Sans Gujarati Variable", sans-serif'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = fail
    im.src = src
  })

/** Greedy word wrap; Gujarati is space-separated, so words are the right unit. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) (lines.push(line), (line = word))
    else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** JPEG: a fraction of the PNG size, which matters when it goes out over WhatsApp. */
export async function quoteCard({ text, reference, title, topic, app, site, type = "image/jpeg" }: {
  text: string; reference: string; title?: string; topic?: string; app: string; site: string
  type?: "image/jpeg" | "image/png" // the clipboard only takes PNG
}): Promise<Blob> {
  await Promise.all([document.fonts.load(`600 60px ${SERIF}`), document.fonts.load(`500 32px ${SANS}`)])
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H })
  const ctx = canvas.getContext("2d")!

  // warm night background
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, "#1d1610")
  bg.addColorStop(1, "#120e0b")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // the sabha painting across the top, fading into the background
  const band = 470
  try {
    const im = await loadImage("/img/sabha.jpg")
    const scale = Math.max(W / im.width, band / im.height)
    const w = im.width * scale, h = im.height * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, band) // keep the painting inside its band
    ctx.clip()
    ctx.drawImage(im, (W - w) * 0.62, (band - h) * 0.4, w, h)
    ctx.restore()
  } catch { /* card still works without the picture */ }
  const fade = ctx.createLinearGradient(0, band * 0.35, 0, band)
  fade.addColorStop(0, "rgba(29,22,16,0)")
  fade.addColorStop(1, "rgba(29,22,16,1)")
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, W, band)

  // topic › subtopic, small and saffron, above the quote
  let top = band + 24
  if (topic) {
    ctx.fillStyle = "#f0a04b"
    ctx.font = `500 28px ${SANS}`
    ctx.textBaseline = "top"
    const t = wrap(ctx, topic, W - PAD * 2)
    t.slice(0, 2).forEach((l, k) => ctx.fillText(k === 1 && t.length > 2 ? l + " …" : l, PAD, top + k * 40))
    top += Math.min(t.length, 2) * 40 + 28
  }

  // quote — shrink the type until it fits the space between topic and footer
  const bottom = H - 250
  let size = 60
  let lines: string[] = []
  for (; size >= 30; size -= 2) {
    ctx.font = `500 ${size}px ${SERIF}`
    lines = wrap(ctx, text, W - PAD * 2)
    if (lines.length * size * 1.75 <= bottom - top) break
  }
  if (lines.length * size * 1.75 > bottom - top) {
    const fit = Math.floor((bottom - top) / (size * 1.75))
    lines = lines.slice(0, fit)
    lines[fit - 1] = lines[fit - 1].replace(/\s*\S*$/, " …")
  }
  ctx.fillStyle = "#f6efe4"
  ctx.textBaseline = "top"
  lines.forEach((l, k) => ctx.fillText(l, PAD, top + k * size * 1.75))

  // reference in saffron, title under it
  ctx.fillStyle = "#f0a04b"
  ctx.fillRect(PAD, H - 222, 64, 4)
  ctx.font = `600 38px ${SANS}`
  ctx.fillText(reference, PAD, H - 196)
  if (title) {
    ctx.fillStyle = "rgba(246,239,228,0.62)"
    ctx.font = `400 30px ${SANS}`
    ctx.fillText(wrap(ctx, title, W - PAD * 2)[0], PAD, H - 142)
  }
  // footer: app name + where to find it
  ctx.fillStyle = "rgba(246,239,228,0.45)"
  ctx.font = `500 26px ${SANS}`
  ctx.fillText(`${app} · ${site}`, PAD, H - 78)

  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("canvas"))), type, 0.9))
}
