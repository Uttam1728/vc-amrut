// Draws shareable quote cards on a canvas and returns them as images.
// 1080×1350 for most quotes; long quotes make the card taller (up to 1080×1920, the phone-story shape);
// quotes too long even for that are split across several cards ("ભાગ ૧ / ૨"), never cut off.
const W = 1080
const H_MIN = 1350
const H_MAX = 1920
const PAD = 96
const BAND = 470 // painting at the top
const LINE = 1.75 // line height, × font size
const FOOTER = 250 // reference + title + app line
const MIN_SIZE = 36 // smallest quote type before splitting into parts
const MAX_PARTS = 4
const SERIF = '"Noto Serif Gujarati Variable", serif'
const SANS = '"Geist Variable", "Noto Sans Gujarati Variable", sans-serif'
const GU = (n: number) => n.toLocaleString("gu-IN")

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

type Opts = {
  text: string; reference: string; title?: string; topic?: string; app: string; site: string
  type?: "image/jpeg" | "image/png" // the clipboard only takes PNG
}

/** All cards for a quote — usually one; very long quotes give 2–4 parts. */
export async function quoteCards({ text, reference, title, topic, app, site, type = "image/jpeg" }: Opts): Promise<Blob[]> {
  await Promise.all([document.fonts.load(`600 60px ${SERIF}`), document.fonts.load(`500 32px ${SANS}`)])
  const painting = await loadImage("/img/sabha.jpg").catch(() => null)
  const m = document.createElement("canvas").getContext("2d")!

  // ── layout: measure first ──
  m.font = `500 28px ${SANS}`
  const topicLines = topic ? wrap(m, topic, W - PAD * 2).slice(0, 2) : []
  const top = BAND + 24 + (topicLines.length ? topicLines.length * 40 + 28 : 0)
  const room = (h: number, size: number) => Math.floor((h - FOOTER - top) / (size * LINE))
  const linesAt = (size: number) => ((m.font = `500 ${size}px ${SERIF}`), wrap(m, text, W - PAD * 2))

  let size = 60, H = H_MIN, lines = linesAt(size)
  while (size > MIN_SIZE && lines.length > room(H, size)) lines = linesAt((size -= 2)) // 1. shrink on the standard card
  if (lines.length > room(H, size)) H = Math.min(H_MAX, Math.ceil(top + lines.length * size * LINE + FOOTER)) // 2. grow
  const split = lines.length > room(H, size)
  const per = room(H, size) - (split ? 1 : 0) // 3. split: keep a line for "continued in part 2"
  const pages: string[][] = []
  for (let k = 0; k < lines.length && pages.length < MAX_PARTS; k += per) pages.push(lines.slice(k, k + per))
  if (pages.length * per < lines.length) pages[pages.length - 1][per - 1] += " …" // beyond MAX_PARTS: the link has the rest

  // ── draw each part ──
  return Promise.all(pages.map((page, p) => {
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H })
    const ctx = canvas.getContext("2d")!
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, "#1d1610")
    bg.addColorStop(1, "#120e0b")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    if (painting) { // the sabha painting across the top, fading into the background
      const scale = Math.max(W / painting.width, BAND / painting.height)
      const w = painting.width * scale, h = painting.height * scale
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, BAND)
      ctx.clip()
      ctx.drawImage(painting, (W - w) * 0.62, (BAND - h) * 0.4, w, h)
      ctx.restore()
    }
    const fade = ctx.createLinearGradient(0, BAND * 0.35, 0, BAND)
    fade.addColorStop(0, "rgba(29,22,16,0)")
    fade.addColorStop(1, "rgba(29,22,16,1)")
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, W, BAND)

    ctx.textBaseline = "top"
    if (pages.length > 1) { // part badge, top-right on the painting
      const label = `ભાગ ${GU(p + 1)} / ${GU(pages.length)}`
      ctx.font = `600 30px ${SANS}`
      const lw = ctx.measureText(label).width + 40
      ctx.fillStyle = "rgba(18,14,11,0.78)"
      ctx.beginPath()
      ctx.roundRect(W - PAD - lw, 48, lw, 56, 28)
      ctx.fill()
      ctx.fillStyle = "#f0a04b"
      ctx.fillText(label, W - PAD - lw + 20, 61)
    }
    if (topicLines.length) {
      ctx.fillStyle = "#f0a04b"
      ctx.font = `500 28px ${SANS}`
      topicLines.forEach((l, k) => ctx.fillText(l, PAD, BAND + 24 + k * 40))
    }

    ctx.fillStyle = "#f6efe4"
    ctx.font = `500 ${size}px ${SERIF}`
    page.forEach((l, k) => ctx.fillText(l, PAD, top + k * size * LINE))
    if (p < pages.length - 1) {
      ctx.fillStyle = "#f0a04b"
      ctx.font = `500 ${Math.round(size * 0.85)}px ${SANS}`
      ctx.fillText(`આગળ ભાગ ${GU(p + 2)} માં →`, PAD, top + page.length * size * LINE + size * 0.2)
    }

    ctx.fillStyle = "#f0a04b"
    ctx.fillRect(PAD, H - 222, 64, 4)
    ctx.font = `600 38px ${SANS}`
    ctx.fillText(reference, PAD, H - 196)
    if (title) {
      ctx.fillStyle = "rgba(246,239,228,0.62)"
      ctx.font = `400 30px ${SANS}`
      ctx.fillText(wrap(ctx, title, W - PAD * 2)[0], PAD, H - 142)
    }
    ctx.fillStyle = "rgba(246,239,228,0.45)"
    ctx.font = `500 26px ${SANS}`
    ctx.fillText(`${app} · ${site}`, PAD, H - 78)

    return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("canvas"))), type, 0.9))
  }))
}

/** First card only (for the clipboard, which holds one image). */
export const quoteCard = async (o: Opts) => (await quoteCards(o))[0]
