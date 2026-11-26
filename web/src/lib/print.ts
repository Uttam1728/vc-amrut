// "PDF" = a clean print layout + the browser's own Save-as-PDF. Browsers shape Gujarati perfectly when
// printing, which JS PDF libraries don't — and it works on phones (iOS: Share → Save to Files; Android: Save as PDF).
export type PrintQuote = { reference: string; title?: string; where?: string; text: string }
export type PrintSection = { name?: string; quotes: PrintQuote[] }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

export function printPdf({ title, subtitle, sections, site }: { title: string; subtitle?: string; sections: PrintSection[]; site: string }) {
  const count = sections.reduce((n, s) => n + s.quotes.length, 0)
  const date = new Date().toLocaleDateString("gu-IN", { day: "numeric", month: "long", year: "numeric" })
  const root = document.createElement("div")
  root.id = "print-root"
  root.innerHTML = `
    <header>
      <p class="pr-app">વચનામૃત અમૃત બિંદુ</p>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="pr-sub">${esc(subtitle)}</p>` : ""}
      <p class="pr-meta">${count} અમૃત બિંદુ · ${date} · ${esc(site)}</p>
    </header>
    ${sections.map((s) => `
      <section>
        ${s.name ? `<h2>${esc(s.name)}</h2>` : ""}
        ${s.quotes.map((q, k) => `
          <article>
            <p class="pr-ref"><span class="pr-n">${k + 1}.</span> ${esc(q.reference)}${q.title ? ` <span class="pr-title">· ${esc(q.title)}</span>` : ""}</p>
            ${q.where ? `<p class="pr-where">${esc(q.where)}</p>` : ""}
            <blockquote>${esc(q.text)}</blockquote>
          </article>`).join("")}
      </section>`).join("")}
    <footer>${esc(site)}</footer>`
  document.body.append(root)
  const prevTitle = document.title
  document.title = `${title}${subtitle ? ` – ${subtitle}` : ""} · વચનામૃત` // becomes the PDF's file name
  const done = () => (root.remove(), (document.title = prevTitle), removeEventListener("afterprint", done))
  addEventListener("afterprint", done)
  // let fonts/layout settle for the new node before the print dialog snapshots it
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
}
