# Hanzi Path 汉字路

A mobile-first PWA for practicing HSK 1 Chinese character stroke order: watch → trace → write from memory, with a lesson path, stars, XP, a daily streak, and spaced-repetition review.

**Cards tab** (merged from the former standalone Hanzi Flashcards): SM-2 flashcards for all 178 characters (字→meaning, meaning→字, pīnyīn→字, mixed; new cards/day; zh-CN audio; deck search; stats + heatmap; JSON backup). Each card has a stroke-checked **write step** (hint after 3 misses, *Show strokes*, *Skip writing*) that must be done or skipped before Again/Hard/Good/Easy appear; a grade is suggested from mistakes. Toggle in Cards › Settings › *Write before grading* (default on). Card state: `localStorage['hanzi-path-cards-v1']` (starts fresh; nothing is imported from the old app). Logic + tests: `src/srs.ts`, `src/srs.test.ts`; UI: `src/Cards.tsx`; e2e: `e2e/review.spec.ts` (440×956 @3x).

- `npm run dev` / `npm run build` / `npm test` (vitest) / `npx playwright test` (WebKit, iPhone 14)
- Data: `scripts/hsk1-source.json` (150 HSK 2.0 level 1 words from complete-hsk-vocabulary, MIT; per-character readings/meanings from CC-CEDICT, CC BY-SA 4.0, built by `scripts/build_vocab.py` + `scripts/char-overrides.json`). `npm run data` bundles stroke data for those 178 characters from hanzi-writer-data (Arphic Public License, via Make Me a Hanzi) into `src/data/`.
- Stroke rendering/quiz: hanzi-writer (MIT).
