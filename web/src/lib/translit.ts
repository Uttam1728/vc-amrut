// Gujarati → Latin transliteration + loose matching so "nishchay" finds "નિશ્ચય".

const CONS: Record<string, string> = {
  ક: "k", ખ: "kh", ગ: "g", ઘ: "gh", ઙ: "ng", ચ: "ch", છ: "chh", જ: "j", ઝ: "jh", ઞ: "ny",
  ટ: "t", ઠ: "th", ડ: "d", ઢ: "dh", ણ: "n", ત: "t", થ: "th", દ: "d", ધ: "dh", ન: "n",
  પ: "p", ફ: "ph", બ: "b", ભ: "bh", મ: "m", ય: "y", ર: "r", લ: "l", ળ: "l", વ: "v",
  શ: "sh", ષ: "sh", સ: "s", હ: "h",
}
const VOWELS: Record<string, string> = {
  અ: "a", આ: "aa", ઇ: "i", ઈ: "ee", ઉ: "u", ઊ: "oo", ઋ: "ru", એ: "e", ઐ: "ai", ઓ: "o", ઔ: "au", ઍ: "e", ઑ: "o",
}
const MATRAS: Record<string, string> = {
  "ા": "aa", "િ": "i", "ી": "ee", "ુ": "u", "ૂ": "oo", "ૃ": "ru", "ે": "e", "ૈ": "ai", "ો": "o", "ૌ": "au", "ૅ": "e", "ૉ": "o",
}
const VIRAMA = "્"
const MARKS: Record<string, string> = { "ં": "n", "ઁ": "n", "ઃ": "h", "઼": "" }

export function translit(gu: string): string {
  let out = ""
  const chars = [...gu]
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (CONS[c] !== undefined) {
      out += CONS[c]
      const next = chars[i + 1]
      if (next === VIRAMA) i++ // half consonant: no vowel
      else if (MATRAS[next] !== undefined) (out += MATRAS[next]), i++
      else out += "a" // inherent vowel
    } else if (VOWELS[c] !== undefined) out += VOWELS[c]
    else if (MARKS[c] !== undefined) out += MARKS[c]
    else if (c >= "૦" && c <= "૯") out += String(c.charCodeAt(0) - 0x0ae6)
    else out += c
  }
  return out
}

// Spelling-agnostic skeleton: drop a/h (schwa + aspiration are spelled inconsistently), fold look-alikes.
export function skeleton(latin: string): string {
  return latin
    .toLowerCase()
    .replace(/ee/g, "i").replace(/oo/g, "u")
    .replace(/w/g, "v").replace(/z/g, "j").replace(/f/g, "p").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/[^a-z0-9]/g, "")
    .replace(/[ah]/g, "")
    .replace(/(.)\1+/g, "$1")
}

const cache = new Map<string, string>()
const keyOf = (label: string) => {
  let k = cache.get(label)
  if (k === undefined) cache.set(label, (k = skeleton(translit(label))))
  return k
}

/** Match a Gujarati label against a Gujarati or English query. */
export function matches(label: string, query: string): boolean {
  const q = query.trim()
  if (!q || label.includes(q)) return true
  if (!/[a-z]/i.test(q)) return false
  const sq = skeleton(q)
  return sq.length > 0 && keyOf(label).includes(sq)
}
