// Builds src/data/hsk1.json (vocab + stroke data for HSK 1 characters only)
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync('scripts/hsk1-source.json','utf8'));
const chars = src.chars.map(c => {
  const d = JSON.parse(fs.readFileSync(`node_modules/hanzi-writer-data/${c.c}.json`,'utf8'));
  return { ...c, n: d.strokes.length };
});
const strokes = {};
for (const c of chars) strokes[c.c] = JSON.parse(fs.readFileSync(`node_modules/hanzi-writer-data/${c.c}.json`,'utf8'));
// order: simplest first (stable by original list order)
chars.sort((a,b)=>a.n-b.n);
fs.writeFileSync('src/data/hsk1.json', JSON.stringify({ words: src.words, chars }));
fs.writeFileSync('src/data/strokes.json', JSON.stringify(strokes));
fs.copyFileSync('node_modules/hanzi-writer-data/ARPHICPL.TXT','public/ARPHICPL.TXT');
console.log(chars.length,'chars', (JSON.stringify(strokes).length/1024|0)+'KB strokes');
