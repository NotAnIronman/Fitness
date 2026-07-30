# Forge - Training Log

A personal fitness dashboard: workout planner with calorie estimates, a dated
workout log with per-exercise progress charts, auto-detected TDEE/BMR with a
BMR/NEAT/TEF/EAT breakdown, a weight-goal tracker with feasibility checks, food
logging, a body fat calculator, and a full theme editor. No backend, no login,
everything is saved in your browser's localStorage.

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
2. In the repo, go to **Settings -> Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Pick your branch (e.g. `main`) and the folder (`/ (root)` or `/docs`).
5. Save. GitHub will give you a URL like `https://yourusername.github.io/reponame/`.

That's it, no build tools, no npm install required for deployment.

## Pages

- **Home** - profile, BMR/TDEE, and a BMR/NEAT/TEF/EAT energy breakdown (tap or
  hover any label for a plain-language explanation).
- **Workout Plan** - your reusable weekly template, exercises organized by body
  part, with a "copy from..." option to duplicate a day.
- **Workout Log** - a dated log, separate from the Plan template. Step backward
  to backfill missed days or forward to plan ahead, copy a Plan day or a previous
  log day in, and see how this week compares to your plan.
- **Progress** - pick any exercise you've logged and see a chart of top
  weight/volume/duration over time, pulled from the Workout Log.
- **Weight Goals** - target weight/date, a progress bar, and a feasibility check.
- **Food Tracking** - search USDA's free food database, adjust serving size or
  correct any nutrition numbers before adding, and see weekly compliance against
  your target.
- **Body Fat** - a US Navy tape-measurement estimate, category reference table,
  and a plain-language explainer on body fat vs. BMI.
- **Themes** - presets (including several softer/pastel options) plus full manual
  control over colors, corner radius, and font pairing.

## How the numbers work

- **BMR** uses the Mifflin-St Jeor equation.
- **Activity level** (and therefore TDEE) is *not* self-reported. It's inferred from
  your actual Workout Plan data: training days/week, average session length,
  and your daily step count, via `autoDetectActivityLevel()` in `js/calc.js`.
- **Energy breakdown** (BMR/NEAT/TEF/EAT) is a commonly cited rough split: BMR is
  usually 60-70% of TDEE, TEF is approximated as ~10% of TDEE, EAT is your average
  daily calories from logged workouts, and NEAT is whatever's left, this is often
  the most underestimated part of someone's day.
- **Exercise calories** use the standard MET formula:
  `kcal = MET x 3.5 x bodyweight(kg) / 200 x minutes`. Strength sets/reps are
  converted to an estimated time-under-tension + partial rest credit. Duration-based
  strength entries (like a general gym session) get a rest-adjustment factor, since
  a 30-minute session might be 80% rest between sets, not continuous effort, so
  counting the full duration at full intensity would badly overstate the burn.
  Weight for sets/reps exercises defaults to total combined load, with a toggle for
  per-arm/per-side entries.
- **Steps** are baseline vs. bonus, not counted in full: each activity level assumes
  a baseline daily step count is already baked into its TDEE multiplier, so only
  steps above that baseline convert to bonus calories.
- **Session/weekly intensity feedback** gives a quick badge (tap for detail) on
  each workout day and the week as a whole, referencing a commonly cited public
  benchmark of roughly 1,000-2,000 kcal/week from exercise for general health
  benefits, plus how many more kcal would reach the next tier.
- **Goal feasibility** compares the required weekly rate of change (via the
  ~3500 kcal/lb rule) against typically-recommended safe ranges, and flags goals
  as reasonable/ambitious/unlikely, informational, not judgmental.
- **Weekly compliance** on the Workout Log and Food pages compares recent actual
  logging against your plan/target and flags a clear gap, so drift from a goal
  gets surfaced instead of silently ignored.
- **Body fat %** uses the US Navy circumference method (neck/waist/hip tape
  measurements), a free, repeatable estimate good for tracking trend over time.

## Food data

Food search uses the free [USDA FoodData Central](https://fdc.nal.usda.gov/) database,
no pricing tiers. It works immediately using USDA's public demo key (shared, lightly
rate-limited); add a free personal key in Themes for higher limits. Picking a search
result opens an adjust-before-adding step, so you can correct any nutrition numbers
that don't match your actual package and set a fractional serving size (e.g. 0.5 for
half a bar). If a search fails, it falls back to a small built-in offline list, and
there's a "+ Custom food" option for anything not in the database. Repeated log
entries of the same food are grouped into a quantity ("3 x Apple") instead of
duplicate rows, with quick +/- chips or a direct fractional input.

## Project structure

```
index.html
css/styles.css        - all styling, theme-driven via CSS custom properties
js/data.js             - exercise library, activity/body-fat/food reference data
js/storage.js          - localStorage load/save, default state shape
js/calc.js              - BMR/TDEE/energy-breakdown/calorie/body-fat/goal formulas
js/theme.js              - theme presets + applying theme to the page
js/app.js                 - router, shell, focus-preserving render, notices/tooltips, Home
js/workouts.js              - Workout Plan view (weekly template)
js/log.js                    - Workout Log view (dated history)
js/progress.js                - Progress view (per-exercise history charts)
js/goals.js                    - weight goal view + chart
js/food.js                      - food tracking view (USDA search)
js/bodyfat.js                    - body fat education + calculator
js/themes.js                      - theme editor + settings (import/export/reset)
```

## Data & privacy

All data lives in `localStorage` under a single key. Nothing is sent to any server
except food searches, which go directly from your browser to USDA's public API. Use
**Themes -> Your data -> Export backup** to save a `.json` copy, and **Import
backup** on another device/browser to bring it over (there's no account system yet,
so this is the way to move data between devices for now). **Reset all data** wipes
the current browser's copy.

## Installing it as an app (PWA)

This is a Progressive Web App: once it's deployed (GitHub Pages or any HTTPS
host - service workers require HTTPS, `http://localhost` is fine for local
testing but a plain non-HTTPS remote host won't work), people can install it
like a native app with no app store involved:

- **Android (Chrome)**: Chrome will usually show an "Install app" prompt
  automatically, or use the browser menu → "Install app" / "Add to Home screen."
- **iPhone/iPad (Safari)**: tap the Share button → "Add to Home Screen." Safari
  doesn't show an automatic install prompt the way Chrome does, so this step has
  to be manual, that's an iOS/Safari limitation, not something a web app can
  change.
- **Desktop (Chrome/Edge)**: an install icon appears in the address bar.

Once installed it launches full-screen with no browser chrome, gets its own
home-screen icon, and the app shell (everything except live network calls like
USDA food search) works offline via the service worker in `sw.js`. All existing
data still lives in `localStorage`, exactly as before, installing doesn't change
where anything is stored.

If you edit any files, bump `CACHE_VERSION` at the top of `sw.js` so people who
already installed the app actually receive the update (otherwise the service
worker keeps serving its cached copy indefinitely).

## Notes on mobile

- Every input that drives a live recalculation uses `render()` to rebuild the view
  on each keystroke. `render()` in `js/app.js` remembers/restores focus and cursor
  position across that rebuild via a `data-focus-id` attribute, so typing doesn't
  get kicked out of the field.
- All inputs use a 16px minimum font size, since anything smaller triggers iOS
  Safari's auto-zoom-on-focus, which is what causes a layout jump when a field is
  tapped.
- Color pickers and the theme's corner-radius slider skip the render cycle
  entirely while dragging (applying straight to CSS variables instead), since
  recreating the DOM mid-drag would cancel the browser's own gesture.
- Tooltips work by hover on desktop and by tap on mobile (a delegated click
  listener toggles them, since touch devices have no hover state).
- Continuous-typing fields (text/number) use a debounced render (`renderSoon()`),
  so the DOM only rebuilds after a short pause in typing, not on every keystroke.
  Date fields commit on `onchange` instead of `oninput`, since native date pickers
  manage their own internal segment focus and rebuilding mid-edit breaks that.
  `render()` also guards reading `selectionStart` in a try/catch, since that
  throws on `number`/`date` inputs in some browsers, this used to silently abort
  the entire render, which is what made those fields look broken/disabled.

## Editing and recent items

Every logged item (Plan exercises, Log exercises, food entries) can be edited
after the fact via the pencil icon, not just removed and re-added. Recently used
exercises and foods show up as one-tap chips (with the last weight/reps/qty
remembered) above the add forms. Sets/reps/weight exercises support either one
weight for all sets or a different weight per set (e.g. ramping sets: 25/35/45 lb).

## Meals

The "+ Build a meal" button on the Food page lets you combine several searched
items (e.g. noodles + sauce + bread for spaghetti) into one named, saved item with
an editable per-item breakdown. Saved meals show up as one-tap chips like recent
foods and log as a single aggregated entry.

## Daily step check-in

Steps are no longer a single self-reported "average" you set once. Log an actual
number each day on the Home page, and `getStepsAverage()` in `js/app.js` computes
a real rolling average from that history (blended with the old estimate early on,
fully trusting real data once you've checked in a handful of times). This feeds
directly into the auto-detected activity level and TDEE math.

## Achievements

A always-visible Achievements tab tracks ~35 milestones across steps, workouts,
nutrition, weight goals, and profile completeness (see `ACHIEVEMENTS` in
`js/data.js`). Evaluation is idempotent and runs on every render via
`evaluateAchievements()` in `js/achievements.js`, so unlocks land the moment
they're earned regardless of which page you're on.

## Pet companion (secret feature)

Off by default. A small "🥚 ???" reveal at the bottom of the Themes page toggles
it on. Once enabled:
- Pick an animal companion and dress it up from a shop (hats, eyewear, facial
  hair, neckwear, accessories) using points earned by checking in on steps,
  logging workouts, and staying on your calorie target, plus a 100-point bonus
  for hitting all of that seven days straight.
- A small widget with an encouraging message follows you to every page (bottom
  right), click it to jump to the Pet tab.
- A lightweight "happiness" meter nudges daily logging Tamagotchi-style: it dips
  a little if you go quiet for more than a day and recovers when you check in,
  purely cosmetic, never blocks anything.
- Unlocking achievements while the pet is enabled also awards pet points.

**On the art**: animals and wearables use native Unicode emoji characters rather
than externally hosted images. OpenMoji (openmoji.org, CC BY-SA 4.0) was
genuinely considered, it's real open-licensed art with a CDN, but referencing
dozens of specific files by exact hex codepoint reliably isn't something to do
from memory (one wrong code silently breaks an image). Native emoji has zero
hosting dependency and zero licensing question, and the whole system in
`js/pet.js` / `PET_ANIMALS` / `PET_ITEMS` in `js/data.js` is written so swapping
in a different art source later is a self-contained change.


