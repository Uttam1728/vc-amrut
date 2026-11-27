// Promo choreography, run inside the app page (412×732 phone at 3×) while rec.mjs records.
// Each shot fills its voice slot (timing.json); the caption shows the spoken line. A finger dot shows every tap and swipe.
async () => {
  const T = TIMING // replaced with timing.json before running
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const main = () => document.querySelector("main")
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const byText = (sel, t) => $$(sel).find((e) => e.innerText.trim().startsWith(t))
  const label = (l) => $(`[aria-label="${l}"]`)
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }

  // ── overlays: caption + finger ──
  const cap = document.createElement("div")
  cap.style.cssText = "position:fixed;left:18px;right:18px;bottom:98px;z-index:99999;pointer-events:none;text-align:center;" +
    "font:600 17px/1.45 'Geist Variable',system-ui,sans-serif;letter-spacing:-.01em;color:#fff;background:rgba(18,14,11,.86);" +
    "backdrop-filter:blur(12px);border:1px solid rgba(240,160,75,.4);border-radius:18px;padding:12px 16px;" +
    "box-shadow:0 10px 30px -8px rgba(0,0,0,.55);transition:opacity .25s,transform .25s;opacity:0;transform:translateY(8px)"
  const dot = document.createElement("div")
  dot.style.cssText = "position:fixed;z-index:100000;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;" +
    "background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.75);box-shadow:0 4px 18px rgba(0,0,0,.35);" +
    "opacity:0;transition:opacity .15s,transform .12s;left:0;top:0"
  document.body.append(cap, dot)
  const say = async (text) => {
    cap.style.opacity = "0"; cap.style.transform = "translateY(8px)"; await wait(180)
    cap.textContent = text; cap.style.opacity = "1"; cap.style.transform = "none"
  }
  const place = (x, y) => { dot.style.left = x + "px"; dot.style.top = y + "px" }
  const tap = async (el, { click = true } = {}) => {
    if (!el) return
    const [x, y] = center(el)
    place(x, y); dot.style.opacity = "1"; await wait(220)
    dot.style.transform = "scale(.8)"; await wait(110)
    if (click) el.click()
    dot.style.transform = "none"; await wait(160); dot.style.opacity = "0"; await wait(120)
  }
  // a real pointer gesture (the deck listens to pointer events), drawn with the finger dot
  const swipe = async (el, dx, dy, ms = 380) => {
    const [x0, y0] = center(el)
    const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1 }))
    place(x0, y0); dot.style.opacity = "1"; await wait(180)
    ev("pointerdown", x0, y0)
    const t0 = performance.now()
    for (;;) {
      await new Promise(requestAnimationFrame)
      const k = Math.min(1, (performance.now() - t0) / ms), e = k * k // accelerating, like a flick
      place(x0 + dx * e, y0 + dy * e); ev("pointermove", x0 + dx * e, y0 + dy * e)
      if (k === 1) break
    }
    ev("pointerup", x0 + dx, y0 + dy)
    dot.style.opacity = "0"; await wait(120)
  }
  // slow, eased scrolling (the browser's smooth scroll is too quick to read)
  const glide = async (el, to, ms) => {
    const from = el.scrollTop, t0 = performance.now()
    for (;;) {
      await new Promise(requestAnimationFrame)
      const k = Math.min(1, (performance.now() - t0) / ms)
      el.scrollTop = from + (to - from) * ease(k)
      if (k === 1) break
    }
  }
  const tab = (name) => byText("nav.fixed a", name)

  const slot = async (i, fn) => {
    const end = performance.now() + T.slots[i] * 1000
    say(T.lines[i])
    await fn()
    const left = end - performance.now()
    if (left > 0) await wait(left)
  }

  location.hash = "#"; await wait(900)
  main().scrollTo(0, 0)
  await wait(300)
  console.log("PROMO_START") // the recorder notes this moment; the voice starts here

  // 1. Home banner
  await slot(0, async () => { await wait(1500) })

  // 2. Today's carousel
  await slot(1, async () => {
    const car = $$("main *").find((e) => getComputedStyle(e).scrollSnapType.includes("x"))
    await glide(main(), main().scrollTop + car.getBoundingClientRect().top - 140, 900)
    for (let k = 0; k < 2; k++) {
      const [x, y] = center(car)
      place(x + 90, y); dot.style.opacity = "1"; await wait(150)
      car.scrollBy({ left: car.clientWidth, behavior: "smooth" })
      for (let s = 0; s <= 10; s++) { place(x + 90 - s * 18, y); await wait(28) }
      dot.style.opacity = "0"; await wait(800)
    }
  })

  // 3. Quick links: continue reading · surprise me · saved (pointed at, not opened)
  await slot(2, async () => {
    const links = ["આગળ વાંચો", "વાંચવાનું શરૂ કરો", "આજે શું વાંચું?", "સાચવેલાં"].map((t) => byText("main a, main button", t)).filter(Boolean)
    await glide(main(), main().scrollTop + links[0].getBoundingClientRect().top - 330, 700)
    for (const l of links) { await tap(l, { click: false }); await wait(350) }
  })

  // 4. Topics and Vachanamruts to try
  await slot(3, async () => {
    const h = (t) => byText("main h3", t)
    await glide(main(), main().scrollTop + h("આજે વાંચવા જેવા વિષયો").getBoundingClientRect().top - 120, 1500)
    await wait(900)
    await glide(main(), main().scrollTop + h("આજે વાંચવા જેવાં વચનામૃત").getBoundingClientRect().top - 120, 1500)
    await wait(1200)
  })

  // 3. Topics tab: themes, scroll through
  await slot(4, async () => {
    await tap(tab("વિષયો")); await wait(500)
    await glide(main(), 900, 1800)
    await tap(byText("[role=tab]", "દોષો")); await wait(700)
  })

  // 4. Open ક્રોધ, scroll the subtopic sheet, pick the biggest one
  await slot(5, async () => {
    await tap(byText("main section a", "ક્રોધ")); await wait(700)
    await tap(byText("main button", "પેટા વિષય")); await wait(600)
    const sheet = $('[role="dialog"]')
    const list = sheet && $$("*", sheet).find((e) => e.scrollHeight > e.clientHeight + 30 && getComputedStyle(e).overflowY !== "visible")
    if (list) { await glide(list, list.scrollHeight, 1500); await wait(200); await glide(list, 0, 700) }
    const opts = sheet ? $$("button, [role=option]", sheet).filter((b) => /\d+\s*$/.test(b.innerText) && !b.innerText.startsWith("બધા")) : []
    const best = opts.sort((a, b) => parseInt(b.innerText.match(/(\d+)\s*$/)[1]) - parseInt(a.innerText.match(/(\d+)\s*$/)[1]))[0]
    await tap(best)
  })

  // 5. Swipe the deck: left, left, right, up, down
  await slot(6, async () => {
    await wait(400)
    const card = () => $('main figure[aria-hidden="false"]')
    for (const [dx, dy] of [[-170, 0], [-170, 0], [170, 0], [0, -190], [0, 190]]) { await swipe(card(), dx, dy); await wait(650) }
  })

  // 6. Double tap = ♥
  await slot(7, async () => {
    const q = $('main figure[aria-hidden="false"] blockquote')
    const [x, y] = center(q)
    place(x, y); dot.style.opacity = "1"; await wait(200)
    // two real touches: the deck counts a double-tap from press/release, not clicks
    const ev = (type) => q.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 8, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1 }))
    for (let k = 0; k < 2; k++) { dot.style.transform = "scale(.8)"; ev("pointerdown"); await wait(70); ev("pointerup"); dot.style.transform = "none"; await wait(110) }
    await wait(200); dot.style.opacity = "0"
  })

  // Saved tab: the card just liked
  await slot(8, async () => {
    await wait(300)
    await tap(tab("સાચવેલાં")); await wait(1200)
  })

  // 7. Vachanamrut tab → ગ. અં. ૨૭
  await slot(9, async () => {
    await tap(tab("વચનામૃત")); await wait(500)
    await glide(main(), 700, 1300)
    await tap(byText("[role=tab]", "ગઢડા અંત્ય")); await wait(500)
    const row = $("#v250")
    await glide(main(), main().scrollTop + row.getBoundingClientRect().top - 330, 800)
    await tap($("#v250 a"))
  })

  // 8. Share → the picture card people receive
  await slot(10, async () => {
    await wait(300)
    await tap(label("શેર કરો")); await wait(900)
    const fig = $('main figure[aria-hidden="false"]')
    const ref = fig.querySelector("a")
    const { quoteCard } = await import("/src/lib/shareCard.ts")
    const blob = await quoteCard({
      text: fig.querySelector("blockquote").innerText, reference: ref.childNodes[0].textContent.trim() + " " + (ref.childNodes[1]?.textContent ?? "").trim(),
      title: ref.querySelector("span")?.textContent.replace(/^ · /, ""), topic: fig.querySelector("p")?.innerText,
      app: "વચનામૃત અમૃત બિંદુ", site: "vachanamrut-amrutbindu.pages.dev",
    })
    const shade = document.createElement("div")
    shade.style.cssText = "position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.72);display:grid;place-items:center;opacity:0;transition:opacity .3s"
    const img = Object.assign(document.createElement("img"), { src: URL.createObjectURL(blob) })
    img.style.cssText = "width:78%;border-radius:16px;box-shadow:0 24px 60px -12px rgba(0,0,0,.7);transform:translateY(60px) scale(.94);transition:transform .5s cubic-bezier(.23,1,.32,1)"
    shade.append(img); document.body.append(shade)
    await wait(40); shade.style.opacity = "1"; img.style.transform = "none"
    await wait(2600)
    shade.style.opacity = "0"; await wait(300); shade.remove()
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })

  // 9. Settings: text size, light ↔ dark
  await slot(11, async () => {
    await wait(300)
    await tap(label("સેટિંગ્સ · Settings")); await wait(500)
    await tap(label("મોટા અક્ષર · Larger")); await wait(350)
    await tap(label("મોટા અક્ષર · Larger")); await wait(500)
    await tap(byText("[role=dialog] button, [data-side] button", "લાઇટ")); await wait(1300)
    await tap(byText("[role=dialog] button, [data-side] button", "ડાર્ક")); await wait(600)
    await tap(label("નાના અક્ષર · Smaller")); await wait(200)
    await tap(label("નાના અક્ષર · Smaller"))
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })

  // 10. Search in English
  await slot(12, async () => {
    await tap(tab("હોમ")); await wait(500)
    main().scrollTo(0, 0)
    const input = $("main input")
    await tap(input, { click: false }); input.focus()
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
    for (const ch of "krodh") { set.call(input, input.value + ch); input.dispatchEvent(new Event("input", { bubbles: true })); await wait(190) }
  })

  // 11. End card
  await slot(13, async () => {
    cap.style.opacity = "0"
    const end = document.createElement("div")
    end.style.cssText = "position:fixed;inset:0;z-index:99998;background:radial-gradient(120% 60% at 30% 0%,rgba(240,160,75,.18),transparent 60%),#161311;" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#f6efe4;opacity:0;transition:opacity .4s"
    end.innerHTML = `<img src="/icon-512.png" style="width:116px;height:116px;border-radius:28px;box-shadow:0 12px 40px -10px rgba(240,160,75,.45)">
      <div style="font:600 32px/1.3 'Noto Serif Gujarati Variable',serif;margin-top:8px">વચનામૃત અમૃત બિંદુ</div>
      <div style="font:500 16px/1.5 'Geist Variable',sans-serif;opacity:.7">Open it today · Add it to your home screen</div>
      <div style="margin-top:10px;font:600 15px 'Geist Variable',sans-serif;color:#f0a04b;border:1px solid rgba(240,160,75,.4);border-radius:999px;padding:10px 18px">vachanamrut-amrutbindu.pages.dev</div>`
    document.body.append(end); await wait(30); end.style.opacity = "1"
  })
  return "done"
}
