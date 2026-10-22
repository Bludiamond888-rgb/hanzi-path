# Hanzi Path 汉字路

A mobile-first PWA for practicing HSK 1 Chinese character stroke order: watch → trace → write from memory, with a lesson path, stars, XP, a daily streak, and spaced-repetition review.

- `npm run dev` / `npm run build` / `npm test` (vitest) / `npx playwright test` (WebKit, iPhone 14)
- Data: `scripts/hsk1-source.json` (150 HSK 2.0 level 1 words from complete-hsk-vocabulary, MIT; per-character readings/meanings from CC-CEDICT, CC BY-SA 4.0, built by `scripts/build_vocab.py` + `scripts/char-overrides.json`). `npm run data` bundles stroke data for those 178 characters from hanzi-writer-data (Arphic Public License, via Make Me a Hanzi) into `src/data/`.
- Stroke rendering/quiz: hanzi-writer (MIT).
