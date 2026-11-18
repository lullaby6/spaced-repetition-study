# Spaced repetition study

Web app to memorize exam answers with active recall and spaced repetition. Each question goes through 4 stages (copy → fill in the blanks → recall with hints → recall with no help). Built with React, Tailwind CSS v4 and daisyUI 5.

## Run

```bash
npm install
npm run dev      # development server
npm run build    # production build in dist/
npm test         # parser, queue and translation checks
```

## Question bank

- The app starts empty: users upload their bank as `.md`, `.txt` or `.pdf` (`### PREGUNTA N … ### FIN` format). Uploading again asks whether to create a new bank, add to the current one or replace it.
- Several banks can be kept side by side, each with its own progress, session and settings; they can be renamed, deleted and edited question by question (Edit questions screen), and downloaded back as `.md`.
- The cloze blanks double as the answer's key words: they are underlined wherever the full answer is shown.
- The home screen has a "Prompt to build the bank with AI" button: a copyable prompt (in `aiPrompt.text` of each language file) that turns a PDF, book or notes into a bank in this format.
- All banks, their progress and sessions are saved in `localStorage` (`study-app-state-v2`) on every change; data from the older single-bank format is migrated automatically.
- `banco-preguntas-estado-bienestar.md` is a sample bank used by `npm run test:parser`; check any bank with `node scripts/test-parser.mjs <file> [ids…]`.

## Language

The UI language is the one picked in the navbar (saved in `localStorage`); until one is picked it follows the browser: any `es-*` → Spanish, anything else → English.

## Structure

| Path | What it does |
| --- | --- |
| `src/lib/parser.js` | Parses bank lines into questions (rejoins wrapped lines, blanks, validation) |
| `src/lib/pdf.js` | Extracts ordered lines from a PDF with pdf.js (lazy-loaded) |
| `src/lib/queue.js` | Study queue: stage transitions, max 6 learning, reviews, session summary |
| `src/lib/text.js` | Normalization, Levenshtein, copy similarity, key point suggestions |
| `src/lib/storage.js` | localStorage persistence and JSON backup export/import |
| `src/languages/*.js` | UI strings, one file per language |
| `src/i18n.jsx` | `I18nProvider`, `useI18n()` → `{ t, lang, setLang }` |

## Adding a language

1. Copy `src/languages/en.js` to e.g. `src/languages/pt.js` and translate the values (keep the keys).
2. Register it in `LANGUAGES` in `src/i18n.jsx`.
3. Run `npm run test:i18n` to check no key is missing.

`t('key.path', { param })` replaces `{param}` placeholders in the string.
