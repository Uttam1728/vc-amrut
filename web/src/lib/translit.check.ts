// Run: node src/lib/translit.check.ts
import assert from "node:assert"
import { matches, translit } from "./translit.ts"

assert.equal(translit("નિશ્ચય"), "nishchaya")
assert.equal(translit("ભક્તિ"), "bhakti")
for (const [gu, en] of [
  ["ભગવાનનો નિશ્ચય", "nishchay"],
  ["ભગવાનનો નિશ્ચય", "bhagwan"],
  ["ભગવાનનો નિશ્ચય", "bhagavaan no"],
  ["આત્મનિષ્ઠા", "atmanishtha"],
  ["આત્યંતિક કલ્યાણ (મોક્ષ)", "moksh"],
  ["કલ્યાણ", "kalyan"],
  ["વૈરાગ્ય", "vairagya"],
  ["ઉપાસના", "upasana"],
  ["સત્સંગ", "satsang"],
  ["ભક્તિ", "ભક્તિ"],
]) assert.ok(matches(gu, en), `${gu} should match ${en}`)
assert.ok(!matches("ભક્તિ", "upasana"))
assert.ok(!matches("કલ્યાણ", "zzz"))
console.log("translit ok")
