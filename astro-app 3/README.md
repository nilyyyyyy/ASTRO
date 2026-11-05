# Trine (working name) · *Decisions, decisions…*

Two views from one birth input:

- **My chart:** chart wheel, every placement explained, saju pillars and Day Master, this year's energy, an astrocartography map with a city checker, and a chat to ask questions about your chart.
- **Decide:** bring a decision and get three lenses:

- **When:** Korean Saju (four pillars, Day Master, element balance, current year)
- **Where:** astrocartography (planet lines near the places involved)
- **Now:** a three-card tarot draw (Situation, Challenge, Guidance)

An AI then combines the lenses and the user's own answers into one reading. It never decides for the user.

## Run it

Requires Node 18 or newer.

```bash
npm install
npm run mock            # full flow, no API key, canned AI text

cp .env.example .env    # then paste your OpenRouter key into .env
npm run check           # verifies model IDs + makes 3 tiny real calls (< $0.001)
npm start               # http://localhost:3000
npm run cost            # cost per session with live OpenRouter prices
```

One OpenRouter key runs everything.

## Deploy on Render (free)

1. The repo must keep the folder structure: `index.html`, `app.js`, `chart.js`, `reflect.js` and `tarot.js` inside `public/`. Don't commit `node_modules` or `.env`.
2. On Render: **New → Web Service**, connect the repo. `render.yaml` sets the build command (`npm install`) and start command (`npm start`). If you set them by hand, use exactly those.
3. Under **Environment**, add `OPENROUTER_API_KEY` with your key.
4. The free plan sleeps after 15 minutes without visitors; the first visit after that takes about a minute.

If a deploy fails, the log starts with a **MISSING FILES** list and tells you what to fix.

## The reflection screen (step 3)

A small game: answering a question, adding a question of your own, or dropping a thought into the **thought jar** lights a star. Seven stars is 100% clarity; three unlock the tarot cards. Any question, including the user's own, has an **Ask the stars** button for a chart-based hint. Answers, own questions, hints and notes all feed into the final reading.

## AI calls per session

| Step | Model (OpenRouter ID) | Endpoint | Job |
|---|---|---|---|
| 1 | `typesafe/jev-1.14` | `/api/alpha/decisions` | Classifies the decision type; screens for crisis and professional-advice topics |
| 2 | `anthropic/claude-haiku-5.5` | `/api/v1/chat/completions` | Writes 3–4 clarifying questions |
| 2b | `anthropic/claude-haiku-5.5` (+ Jev screen for the user's own questions) | `/api/v1/chat/completions` | "Ask the stars": an astrology-based hint for any question the user is stuck on |
| 3 | `anthropic/claude-sonnet-5.5` | `/api/v1/chat/completions` | Writes the combined reading (JSON) |

- If Jev flags a possible crisis, or Claude does, the app shows support resources instead of a reading.
- If Jev is unavailable, the app falls back to a keyword check and keeps working. `npm run check` shows the real error.
- Every call's tokens and cost appear at the bottom of the page.
- Models are set in `.env` (`MODEL_FAST`, `MODEL_DEEP`, `MODEL_JEV`). IDs verified on openrouter.ai in November 2026.

## Files

| File | Role |
|---|---|
| `engine.js` | All astrology maths: Western chart (whole-sign houses), Saju pillars, astrocartography lines. No AI. |
| `public/` | The page (`index.html`, `app.js`), My chart frame (`chart.js`), reflection game (`reflect.js`), tarot deck (`tarot.js`) |
| `prompts.js` | All AI prompts and the Jev questions |
| `ai.js` | OpenRouter chat + Jev decisions clients, mock responses |
| `server.js` | Serves the app and `/api/questions`, `/api/hint`, `/api/chat`, `/api/reading` |
| `config.js` | Reads `.env` |
| `check.js` | Pre-flight check for key and model IDs |
| `cost-calculator.js` | Session cost from live prices |

## Licences and data

- astronomy-engine, lunar-javascript, topojson-client: MIT. world-atlas: ISC (Natural Earth data, public domain).
- Place search uses the Open-Meteo geocoding API, free for **non-commercial** use only. Replace it or take a paid plan before charging users.
- Birth data is personal data under GDPR. Add a privacy policy before launch.
- Never commit `.env` (it is in `.gitignore`).

## Known limits

- North Node is the mean node (CHANI uses the true node, about 1° different).
- Profile (name + birth data) is remembered on the user's own device only ("Remember me"); no server accounts or payments yet.
- To rename the app, change the `<title>`, `#brandName` and `#brandTag` in `public/index.html`.
