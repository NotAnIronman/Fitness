# Forge — Training Log

A personal fitness dashboard: workout planner with calorie estimates, auto-detected
TDEE/BMR, a weight-goal tracker with feasibility checks, food logging, and a full
theme editor. No backend, no login — everything is saved in your browser's
localStorage.

## Run it locally

No build step needed. Either:

- Open `index.html` directly in a browser, or
- Serve it locally (recommended, avoids some browser file:// restrictions):
  ```
  python3 -m http.server 8000
  ```
  then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (root of the repo, or a `/docs` folder).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Pick your branch (e.g. `main`) and the folder (`/ (root)` or `/docs`).
5. Save. GitHub will give you a URL like `https://yourusername.github.io/reponame/`.

That's it — no build tools, no npm install required for deployment.

## How the numbers work

- **BMR** uses the Mifflin-St Jeor equation.
- **Activity level** (and therefore TDEE) is *not* self-reported. It's inferred from
  your actual Workout Planner data — training days/week, average session length,
  and your daily step count — via `autoDetectActivityLevel()` in `js/calc.js`.
- **Exercise calories** use the standard MET formula:
  `kcal = MET × 3.5 × bodyweight(kg) / 200 × minutes`. Strength sets/reps are
  converted to an estimated time-under-tension + partial rest credit.
- **Goal feasibility** compares the required weekly rate of change (via the
  ~3500 kcal/lb rule) against typically-recommended safe ranges, and flags
  goals as reasonable / ambitious / unlikely — informational, not judgmental.

## Food data

Food search uses a small built-in offline list by default. For full food search,
add a free [Nutritionix API](https://www.nutritionix.com/business/api) App ID/Key
in the Themes page (bottom section, "Nutritionix API"). Keys are stored only in
your browser's localStorage — never sent anywhere except directly to Nutritionix's
API from your browser.

## Project structure

```
index.html
css/styles.css        — all styling, theme-driven via CSS custom properties
js/data.js             — exercise MET library + offline food database
js/storage.js          — localStorage load/save, default state shape
js/calc.js              — BMR/TDEE/calorie/goal-feasibility formulas
js/theme.js              — theme presets + applying theme to the page
js/app.js                 — router, shell, Home/profile/BMR view
js/workouts.js             — workout planner view
js/goals.js                 — weight goal view + chart
js/food.js                   — food tracking view
js/themes.js                  — theme editor + settings (data export/reset)
```

## Data & privacy

All data (profile, workout plans, weight log, food log, theme, API keys) lives in
`localStorage` under a single key. Nothing is sent to any server except food
searches, which go directly from your browser to Nutritionix if you've added keys.
Use **Themes → Your data → Export backup** to save a `.json` copy, or **Reset all
data** to start fresh.

A future version could add real accounts and server-side sync — the storage layer
(`js/storage.js`) is intentionally isolated so `loadState()`/`saveState()` can be
swapped for API calls later without touching the rest of the app.
