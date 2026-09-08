# Forge Training Log

Forge is a local-first fitness tracker for people who want useful planning and
logging without creating an account or surrendering a health history. It runs as
a website or installable PWA and keeps its app state in the current browser.

## Product direction

The daily loop should be obvious: open **Today**, log a workout or steps, log
food, and review progress. Setup and occasional tools live under **More**. The
app should give a useful starting estimate while showing where uncertainty comes
from; it should never present calculated calories, exercise burn, body fat, or a
projected weight path as a direct measurement.

## Local-first is not a dead end

No login is a feature, not a technical ceiling. Static hosting keeps Forge cheap,
fast, auditable, and easy to contribute to. App updates are delivered through the
normal deployment plus the service worker cache version. State migrations in
`js/storage.js` preserve older local saves as fields are added.

The tradeoffs are deliberate:

- Browser storage can be cleared and does not automatically follow a user to a
  new device. Forge therefore provides file, share-sheet, clipboard, and QR
  backup/transfer options.
- Apple Health and Android Health Connect require small native wrappers; the web
  app remains fully usable without them.
- Multi-device automatic sync, shared coaching, or recovery after device loss
  would require an optional service later.

If those features become valuable, add **optional** end-to-end encrypted sync or
user-selected storage rather than making an account mandatory. The local state
object is already isolated behind `loadState()` and `saveState()`, so a sync
adapter can be introduced without rewriting the trackers.

## Energy model

Forge uses the Mifflin-St Jeor equation for resting energy expenditure. It no
longer promotes users through coarse activity multipliers. Maintenance starts at
`BMR × 1.2`, adds weight-adjusted walking above a 3,000-step baseline, and adds a
discounted daily average of planned exercise. The UI shows both a midpoint and a
broad uncertainty range.

That midpoint is a starting hypothesis. Two to four weeks of consistent food and
comparable weight logs are more informative than any calculator. Future work can
use those logs for an explicitly opt-in, locally calculated calibration.

Primary references:

- Mifflin et al., 1990: https://pubmed.ncbi.nlm.nih.gov/2305711/
- NIDDK Body Weight Planner research: https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner
- USDA FoodData Central API: https://fdc.nal.usda.gov/api-guide/

## Running locally

Serve the folder over HTTP rather than opening `index.html` with `file://` so the
service worker and browser APIs behave normally:

```powershell
node tests/dev-server.js
```

Run the calculation checks with:

```powershell
node tests/calculations.test.js
```

When app files change, bump both `APP_VERSION` in `js/app.js` and
`CACHE_VERSION` in `sw.js`.
