/* ============================================================
   THEMES + SETTINGS VIEW
   Color pickers and the radius slider apply directly to the live
   CSS variables and skip the full render() cycle, since rebuilding
   the DOM mid-drag (color picker drag, slider drag) would cancel
   the gesture the browser is tracking.
   ============================================================ */

function renderThemes() {
  const t = STATE.theme;
  const fontOptions = [
    { key: 'condensed', label: 'Oswald / Inter' },
    { key: 'serif', label: 'Fraunces / Inter' },
    { key: 'mono', label: 'All Mono' },
    { key: 'rounded', label: 'Space Grotesk / Inter' },
    { key: 'grotesk', label: 'All Space Grotesk' },
    { key: 'classic_serif', label: 'Playfair Display / Lora' },
    { key: 'elegant_script', label: 'Cormorant Garamond / Lora' },
    { key: 'friendly_round', label: 'Quicksand / Nunito' },
    { key: 'bold_display', label: 'Bebas Neue / Inter' },
    { key: 'clean_system', label: 'Work Sans' },
    { key: 'editorial', label: 'Libre Baskerville / Nunito' },
    { key: 'playful', label: 'Baloo 2 / Nunito' },
    { key: 'whimsical', label: 'Macondo / Nunito \u2728' },
    { key: 'storybook', label: 'Leckerli One / Quicksand \u2728' },
    { key: 'bubbly', label: 'Pacifico / Comfortaa \u2728' },
    { key: 'handwritten', label: 'Dancing Script / Nunito \u2728' },
    { key: 'cozy_note', label: 'Caveat / Inter \u2728' },
    { key: 'soft_rounded', label: 'Comfortaa \u2728' },
    { key: 'cheerful', label: 'Fredoka / Nunito \u2728' },
    { key: 'candy', label: 'Chewy / Quicksand \u2728' },
  ];

  return `
    <div class="page-head">
      <p class="page-eyebrow">Personalize</p>
      <h1 class="page-title">Themes</h1>
      <p class="page-sub">Make it feel like yours. Pick a preset as a starting point, then override any color, corner radius, or font pairing.</p>
    </div>

    <div class="card">
      <div class="card-title">Presets</div>
      <div class="grid grid-3">
        ${Object.entries(THEME_PRESETS).map(([key, p]) => `
          <div class="theme-preset-card ${t.preset === key ? 'active' : ''}" onclick="applyPreset('${key}')">
            <div class="theme-preset-swatch">
              <span style="background:${p.bg}"></span>
              <span style="background:${p.surface}"></span>
              <span style="background:${p.accent}"></span>
              <span style="background:${p.accent2}"></span>
            </div>
            <div class="theme-preset-name">${p.label}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Fine-tune colors</div>
      <div class="grid grid-4">
        ${colorField('Background', 'bg', t.bg)}
        ${colorField('Surface', 'surface', t.surface)}
        ${colorField('Text', 'text', t.text)}
        ${colorField('Muted text', 'textDim', t.textDim)}
        ${colorField('Accent', 'accent', t.accent)}
        ${colorField('Accent 2', 'accent2', t.accent2)}
        ${colorField('Border', 'border', t.border)}
        ${colorField('Surface 2', 'surface2', t.surface2)}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">Shape</div>
        <div class="field">
          <label>Corner radius: <span id="radius-label">${t.radius}</span>px</label>
          <input type="range" id="radius-slider" min="0" max="24" value="${t.radius}" oninput="liveUpdateRadius(this.value)" onchange="commitRadius(this.value)">
        </div>
      </div>
      <div class="card">
        <div class="card-title">Typography</div>
        <div class="field">
          <label>Font pairing</label>
          <select data-focus-id="theme-font" onchange="updateThemeField('font', this.value)">
            ${fontOptions.map(f => `<option value="${f.key}" ${t.font === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Food search API (optional)</div>
      <p class="hint" style="margin-bottom:12px;">Food search uses the free <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> database, no pricing tiers.
      It works out of the box on USDA's public demo key, which has light rate limits shared by everyone using it. For higher limits, grab your own free key at
      <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">fdc.nal.usda.gov/api-key-signup.html</a> and paste it below. Stored only in this browser.
      The app also keeps a growing local cache of everything you've searched before (${STATE.foodIndexPool.length} item${STATE.foodIndexPool.length === 1 ? '' : 's'} cached so far), so the more you use it, the fewer searches need to hit USDA at all.</p>
      <div class="field" style="max-width:360px;">
        <label>USDA API key</label>
        <input type="text" data-focus-id="usda-key" value="${escapeAttr(STATE.foodApiKey)}" placeholder="DEMO_KEY (default)" onchange="updateFoodApiKey(this.value)" onkeydown="if(event.key==='Enter') this.blur()">
      </div>
    </div>

    <div class="card">
      <div class="card-title">Your data</div>
      <p class="hint" style="margin-bottom:12px;">Everything lives in this browser's local storage, nothing is sent anywhere except food searches. There's no account and no server this data passes through, syncing between your own devices is entirely up to you, using whichever option below actually works on what you've got.</p>

      <p class="hint" style="margin-bottom:6px;"><strong style="color:var(--text);">Fastest, if supported:</strong> share directly to another device you're holding (AirDrop, Nearby Share, Bluetooth), no file to find and re-upload.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="btn btn-primary" onclick="shareBackup()">\ud83d\udce4 Share to another device</button>
      </div>

      <p class="hint" style="margin-bottom:6px;"><strong style="color:var(--text);">Works everywhere:</strong> copy a sync code on this device, paste it into Forge on the other one.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="btn" onclick="copySyncCode()">Copy sync code</button>
        <button class="btn" onclick="togglePasteSync()">${UI.pasteSyncOpen ? 'Cancel paste' : 'Paste sync code'}</button>
      </div>
      ${UI.pasteSyncOpen ? `
        <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:12px; margin-bottom:16px;">
          <p class="hint" style="margin-bottom:8px;">Paste the code copied from your other device. Forge merges dated logs and keeps the incoming copy when the same setting or date exists on both devices. Export a backup first if both devices contain changes you cannot recreate.</p>
          <textarea id="paste-sync-text" data-focus-id="paste-sync-text" rows="4" style="font-family:var(--font-mono); font-size:11px;" placeholder="Paste sync code here"></textarea>
          <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="importFromPasteSync()">Sync from pasted code</button>
        </div>
      ` : ''}

      <p class="hint" style="margin-bottom:6px;"><strong style="color:var(--text);">Traditional file backup:</strong> a .json file you keep somewhere (or attach to an email to yourself, upload to your own cloud storage, etc).</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn" onclick="exportData()">Export backup (.json)</button>
        <button class="btn" onclick="document.getElementById('import-file-input').click()">Import backup (.json)</button>
        <input type="file" id="import-file-input" accept="application/json,.json" style="display:none;" onchange="importData(event)">
        <button class="btn btn-danger" onclick="resetAllData()">Reset all data</button>
      </div>
    </div>

    ${renderSecretSettings()}
  `;
}

function renderSecretSettings() {
  if (!UI.secretPanelOpen) {
    return `<div style="text-align:center; margin-top:8px;"><button class="notice-pill" onclick="toggleSecretPanel()" style="opacity:0.5;">🥚 ???</button></div>`;
  }
  return `
    <div class="card">
      <div class="card-title">🥚 Secret settings</div>
      <div class="field-row" style="align-items:center;">
        <div class="field" style="margin-bottom:0;">
          <label>Pet companion</label>
          <p class="hint">A little character that hangs out on every page and cheers you on. Earn points by checking in on steps, logging workouts, and staying on target, then spend them dressing your pet up.</p>
        </div>
        <button class="btn ${STATE.pet.enabled ? 'btn-primary' : ''}" onclick="togglePetEnabled()">${STATE.pet.enabled ? 'Disable' : 'Enable'} pet</button>
      </div>
      <hr class="div">
      <div class="field-row" style="align-items:center;">
        <div class="field" style="margin-bottom:0;">
          <label>Guided setup</label>
          <p class="hint">Restart Coach's data-aware walkthrough of profile, training, steps, goals, and food logging.</p>
        </div>
        <button class="btn" onclick="restartOnboarding()">Restart guide</button>
      </div>
    </div>
  `;
}

function colorField(label, key, value) {
  return `
    <div class="field">
      <label>${label}</label>
      <input type="color" data-theme-key="${key}" value="${value}" oninput="liveUpdateColor('${key}', this.value)" onchange="commitColor('${key}', this.value)">
    </div>
  `;
}

function applyPreset(key) {
  STATE.theme = themeFromPreset(key);
  persist(); render();
}

// --- Live-apply while dragging (no render, keeps the native picker/slider gesture intact) ---
function liveUpdateColor(key, value) {
  STATE.theme[key] = value;
  applyTheme(STATE.theme);
}
function commitColor(key, value) {
  STATE.theme[key] = value;
  STATE.theme.preset = 'custom';
  applyTheme(STATE.theme);
  persist();
  // refresh preset "active" highlighting without disturbing focus
  render();
}

function liveUpdateRadius(value) {
  STATE.theme.radius = Number(value);
  applyTheme(STATE.theme);
  const label = document.getElementById('radius-label');
  if (label) label.textContent = value;
}
function commitRadius(value) {
  STATE.theme.radius = Number(value);
  STATE.theme.preset = 'custom';
  persist();
}

function updateThemeField(key, value) {
  STATE.theme[key] = value;
  STATE.theme.preset = 'custom';
  persist(); render();
}

function updateFoodApiKey(value) {
  STATE.foodApiKey = value;
  persist();
}

/* ---------- Compression for sync transport ----------
   Uses the browser's native CompressionStream (no library, broadly supported
   in current browsers), this meaningfully extends how much history fits in a
   clipboard sync code or a shared file before hitting a practical limit,
   fitness/food JSON is very repetitive and typically compresses 5-10x.
   Falls back to plain JSON automatically if CompressionStream isn't
   available, and decompress auto-detects which format it's looking at, so
   old plain-JSON sync codes/files still import fine. */
async function compressToBase64(str) {
  if (typeof CompressionStream === 'undefined') return { data: str, compressed: false };
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return { data: arrayBufferToBase64(buffer), compressed: true };
}
async function decompressFromText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed); // plain JSON, uncompressed
  if (typeof DecompressionStream === 'undefined') {
    throw new Error("This looks like a compressed sync code, but this browser can't decompress it. Try exporting/importing a plain .json file instead.");
  }
  const buffer = base64ToArrayBuffer(trimmed);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const json = await new Response(stream).text();
  return JSON.parse(json);
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Merges imported data onto the CURRENT state instead of a blank default,
// so syncing between two devices that have both logged something since the
// last sync doesn't wipe out whatever's only on the receiving device. Plain
// objects (including date-keyed logs like foodLog/workoutLog/dailyCheckins)
// merge key-by-key via deepMerge already; weightLog is a plain array so it
// needs its own dedup-by-date merge, most other arrays (savedMeals, the
// workout plan template, etc) are treated as "whichever was synced most
// recently wins," which is a reasonable default for data that isn't
// naturally date-keyed.
function mergeImportedState(incoming) {
  const safeIncoming = prepareImportedState(incoming);
  const mergedWeightLog = mergeWeightLogs(STATE.weightLog, safeIncoming.weightLog || []);
  const next = deepMerge(STATE, safeIncoming);
  next.weightLog = mergedWeightLog;
  next.workoutLog = mergeDatedEntryLogs(STATE.workoutLog, safeIncoming.workoutLog, true);
  next.foodLog = mergeDatedEntryLogs(STATE.foodLog, safeIncoming.foodLog, false);
  return next;
}

function mergeDatedEntryLogs(existing, incoming, useId) {
  const out = { ...(existing || {}) };
  Object.keys(incoming || {}).forEach(date => {
    const current = Array.isArray(out[date]) ? out[date] : [];
    const added = Array.isArray(incoming[date]) ? incoming[date] : [];
    if (useId) {
      const byId = new Map();
      current.forEach(e => byId.set(e.id || JSON.stringify(e), e));
      added.forEach(e => byId.set(e.id || JSON.stringify(e), e));
      out[date] = Array.from(byId.values());
    } else {
      const seen = new Set(current.map(e => JSON.stringify(e)));
      out[date] = current.slice();
      added.forEach(e => {
        const signature = JSON.stringify(e);
        if (!seen.has(signature)) { seen.add(signature); out[date].push(e); }
      });
    }
  });
  return out;
}
function mergeWeightLogs(existing, incoming) {
  const byDate = new Map();
  (existing || []).forEach(e => byDate.set(e.date, e));
  (incoming || []).forEach(e => byDate.set(e.date, e)); // incoming wins on same-date conflicts
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Uses the OS's own native share sheet (AirDrop, Nearby Share, Bluetooth, or
// any app that accepts a file) to send the backup directly to another device,
// no server or account involved, this just hands the file to the OS. Not
// every browser supports sharing files (desktop support is spotty). Android's
// share sheet in particular has a real, fairly low size ceiling for files
// passed this way (its underlying IPC mechanism caps out around ~1MB), so
// this compresses first and, if the compressed result is still too large,
// steps aside proactively rather than attempting a share that's likely to
// fail with an unhelpful error.
const SHARE_SIZE_WARNING_BYTES = 900000;
async function shareBackup() {
  try {
    const { data, compressed } = await compressToBase64(JSON.stringify(STATE));
    const approxBytes = data.length;
    if (approxBytes > SHARE_SIZE_WARNING_BYTES) {
      toast("Your backup has grown too large for Android's share sheet to reliably handle, use Export or Copy sync code instead.");
      return;
    }
    const filename = compressed ? `forge-backup-${todayISO()}.json.gz.txt` : `forge-backup-${todayISO()}.json`;
    const file = new File([data], filename, { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Forge backup', text: 'Forge training log backup (open with Forge > Themes > Import)' });
    } else {
      toast("Sharing files isn't supported in this browser, try Copy sync code or Export instead.");
    }
  } catch (e) {
    if (e && e.name !== 'AbortError') { // AbortError just means they closed the share sheet, not a real failure
      console.error(e);
      toast(`Could not open the share sheet (${e.message || e.name || 'unknown error'}), try Copy sync code or Export instead.`);
    }
  }
}

// Copies the whole backup to the clipboard as a compressed sync code, works
// on essentially any device/browser, paste it into the "Paste sync code" box
// on the other one.
async function copySyncCode() {
  try {
    const { data } = await compressToBase64(JSON.stringify(STATE));
    await navigator.clipboard.writeText(data);
    toast("Copied! Paste it into Forge on your other device (Themes -> Paste sync code).");
  } catch (e) {
    console.error(e);
    toast(`Could not copy automatically (${e.message || 'unknown error'}), try Export instead.`);
  }
}

function togglePasteSync() {
  UI.pasteSyncOpen = !UI.pasteSyncOpen;
  render();
}

async function importFromPasteSync() {
  const textEl = document.getElementById('paste-sync-text');
  const text = textEl ? textEl.value.trim() : '';
  if (!text) { toast('Paste your sync code first'); return; }
  try {
    const parsed = await decompressFromText(text);
    STATE = mergeImportedState(parsed);
    persist();
    UI.pasteSyncOpen = false;
    render();
    toast('Synced from pasted code!');
  } catch (e) {
    console.error(e);
    alert(e.message && e.message.includes('sync code') ? e.message : "That doesn't look like a valid Forge sync code. Make sure you copied the whole thing.");
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forge-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      STATE = mergeImportedState(parsed);
      persist();
      render();
      toast('Backup imported');
    } catch (e) {
      console.error(e);
      alert('That file could not be read as a Forge backup. Make sure it is the .json file exported from this app.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function toggleSecretPanel() {
  UI.secretPanelOpen = !UI.secretPanelOpen;
  render();
}
function togglePetEnabled() {
  STATE.pet.enabled = !STATE.pet.enabled;
  if (!STATE.pet.enabled && STATE.onboarding.active) {
    STATE.onboarding.active = false;
    STATE.onboarding.dismissed = true;
  }
  persist(); render();
  if (STATE.pet.enabled) toast('Pet companion enabled! Check the new Pet tab.');
}

function resetAllData() {
  if (!confirm('This will permanently delete all local data. Continue?')) return;
  STATE = defaultState();
  persist();
  UI.route = 'home';
  saveLastRoute('home');
  render();
}
