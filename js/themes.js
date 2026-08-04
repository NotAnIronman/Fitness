/* ============================================================
   THEMES + SETTINGS VIEW
   Color pickers and the radius slider apply directly to the live
   CSS variables and skip the full render() cycle, since rebuilding
   the DOM mid-drag (color picker drag, slider drag) would cancel
   the gesture the browser is tracking.
   ============================================================ */

function renderThemes() {
  const t = STATE.theme;
  const accessibilityIssues = getThemeAccessibilityIssues(t);
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

    <div class="card ${onboardingStepIs('theme_preset') ? 'onboarding-focus' : ''}">
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
      ${accessibilityIssues.length ? `<div class="section-note" role="status"><strong>Contrast check:</strong> ${accessibilityIssues.map(escapeAttr).join('; ')}. Aim for at least 4.5:1 for normal text, or choose an accessible preset before fine-tuning.</div>` : `<div class="hint" role="status">Contrast check passed for main, muted, and accent text (at least 4.5:1).</div>`}
    </div>

    <div class="grid grid-2">
      <div class="card ${onboardingStepIs('theme_shape') ? 'onboarding-focus' : ''}">
        <div class="card-title">Shape</div>
        <div class="field">
          <label>Corner radius: <span id="radius-label">${t.radius}</span>px</label>
          <input type="range" id="radius-slider" min="0" max="24" value="${t.radius}" oninput="liveUpdateRadius(this.value)" onchange="commitRadius(this.value)">
        </div>
      </div>
      <div class="card ${onboardingStepIs('theme_font') ? 'onboarding-focus' : ''}">
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

    ${renderDayShareCard()}

    <div class="card ${onboardingStepIs('transfer_info') ? 'onboarding-focus' : ''}">
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

      <p class="hint" style="margin-bottom:6px;"><strong style="color:var(--text);">Camera-to-camera QR:</strong> best for setup or recent changes. Forge removes rebuildable search caches and never asks you to scan more than six codes; use Share or Export for a large full history. Nothing is uploaded.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="btn" onclick="startQrTransferSend()">Show transfer QR</button>
        <button class="btn" onclick="openQrTransferReceiver()">Scan transfer QR</button>
      </div>
      ${UI.qrTransferMode ? renderQrTransferPanel() : ''}

      <p class="hint" style="margin-bottom:6px;"><strong style="color:var(--text);">Traditional file backup:</strong> a .json file you keep somewhere (or attach to an email to yourself, upload to your own cloud storage, etc).</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn" onclick="exportData()">Export backup (.json)</button>
        <button class="btn" onclick="document.getElementById('import-file-input').click()">Import backup (.json)</button>
        <input type="file" id="import-file-input" accept="application/json,.json" style="display:none;" onchange="importData(event)">
        <button class="btn btn-danger" onclick="resetAllData()">Reset all data</button>
      </div>
    </div>

    <div class="card ${onboardingStepIs('contact_info') ? 'onboarding-focus' : ''}">
      <div class="card-title">Contact & support</div>
      <p class="hint">Found a bug, have an idea, or need help? Contact <a href="mailto:ForgeTrainingLog@gmail.com">ForgeTrainingLog@gmail.com</a>. Forge does not attach or transmit your local health data.</p>
      <div class="field"><label>Optional message draft</label><textarea id="support-message" rows="4" maxlength="4000" placeholder="What happened, what did you expect, and which device/browser are you using?"></textarea></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="openSupportEmail()">Open email app</button>
        <button class="btn" onclick="copySupportEmail()">Copy email address</button>
      </div>
      <p class="hint" style="margin-top:8px;">Opening the email app keeps sending under your control. A future in-page Send button would require a protected server endpoint and abuse controls; no email-service credentials belong in this static app.</p>
    </div>

    ${renderSecretSettings()}
  `;
}

const DAY_SHARE_OPTIONS = [
  { key: 'steps', label: 'Steps' },
  { key: 'nutrition', label: 'Calories & macros' },
  { key: 'workout', label: 'Completed exercises' },
  { key: 'pet', label: 'Pet status' },
];

function renderDayShareCard() {
  const date = UI.shareDayDate || todayISO();
  const selected = STATE.uiPrefs.dayShareSections || [];
  const preview = buildDayShareSnapshot(date, selected);
  return `<div class="card day-share-card">
    <div class="card-title">Share a day</div>
    <p class="hint">Create a plain-text snapshot and choose exactly what it contains. Private workout notes, profile details, targets, and history are never included. Your device's share sheet can offer text, email, messaging, or other installed apps.</p>
    <div class="field" style="max-width:320px;"><label>Snapshot date</label><input type="date" value="${date}" onchange="setShareDayDate(this.value)"></div>
    <fieldset class="share-section-picker"><legend>Include</legend><div class="chip-row">
      ${DAY_SHARE_OPTIONS.map(option => `<label class="share-option ${selected.includes(option.key) ? 'active' : ''}"><input type="checkbox" ${selected.includes(option.key) ? 'checked' : ''} onchange="toggleDayShareSection('${option.key}')"><span>${escapeAttr(option.label)}</span></label>`).join('')}
    </div></fieldset>
    <pre class="day-share-preview">${escapeAttr(preview || 'Select at least one section to build a snapshot.')}</pre>
    <div class="share-actions"><button class="btn btn-primary" ${preview ? '' : 'disabled'} onclick="shareDaySnapshot()">Share snapshot</button><button class="btn" ${preview ? '' : 'disabled'} onclick="copyDaySnapshot()">Copy text</button></div>
    <p class="hint" style="margin-top:8px;">Sharing is initiated only when you press the button. Forge does not upload or retain a copy.</p>
  </div>`;
}

function setShareDayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return;
  UI.shareDayDate = value;
  render();
}

function toggleDayShareSection(key) {
  if (!DAY_SHARE_OPTIONS.some(option => option.key === key)) return;
  const selected = new Set(STATE.uiPrefs.dayShareSections || []);
  if (selected.has(key)) selected.delete(key); else selected.add(key);
  STATE.uiPrefs.dayShareSections = DAY_SHARE_OPTIONS.map(option => option.key).filter(option => selected.has(option));
  persist(); render();
}

function shareExerciseLine(entry) {
  const exercise = EXERCISE_LIBRARY.find(item => item.id === entry.exerciseId) || entry.custom || { name: 'Custom exercise', inputMode: 'setsReps' };
  const completed = completedExerciseEntry(entry);
  if (!completed) return null;
  if (completed.perSetWeights?.length) {
    const reps = completed.perSetWeights.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
    return `${exercise.name}: ${completed.perSetWeights.length} set(s), ${reps} total reps`;
  }
  if (exercise.inputMode === 'duration' || exercise.inputMode === 'distance') return `${exercise.name}: ${Number(completed.durationMin) || 0} min`;
  return `${exercise.name}: ${Number(completed.sets) || 0} × ${Number(completed.reps) || 0}`;
}

function buildDayShareSnapshot(date, sections) {
  const selected = new Set(sections || []);
  if (!selected.size) return '';
  const lines = [`Forge day snapshot — ${date}`];
  if (selected.has('steps')) {
    const steps = STATE.dailyCheckins[date]?.steps;
    lines.push('', 'STEPS', steps == null ? 'No step check-in' : `${Number(steps).toLocaleString()} steps`);
  }
  if (selected.has('nutrition')) {
    const foods = STATE.foodLog[date] || [];
    const totals = foods.reduce((sum, food) => ({
      kcal: sum.kcal + (Number(food.kcal) || 0) * (Number(food.qty) || 1),
      protein: sum.protein + (Number(food.protein) || 0) * (Number(food.qty) || 1),
      carbs: sum.carbs + (Number(food.carbs) || 0) * (Number(food.qty) || 1),
      fat: sum.fat + (Number(food.fat) || 0) * (Number(food.qty) || 1),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    lines.push('', 'NUTRITION', foods.length
      ? `${Math.round(totals.kcal)} kcal · P ${Math.round(totals.protein)}g · C ${Math.round(totals.carbs)}g · F ${Math.round(totals.fat)}g`
      : 'No food logged');
  }
  if (selected.has('workout')) {
    const exercises = (STATE.workoutLog[date] || []).map(shareExerciseLine).filter(Boolean);
    lines.push('', 'WORKOUT', ...(exercises.length ? exercises : ['No completed exercises']));
  }
  if (selected.has('pet')) {
    const animal = PET_ANIMALS.find(item => item.key === STATE.pet.species);
    const medals = Object.keys(STATE.pet.travel?.medals || {}).length;
    lines.push('', 'PET', `${STATE.pet.name || 'Pet'}${animal ? ` the ${animal.name}` : ''} · Happiness ${Math.round(STATE.pet.happiness)}% · Hunger ${Math.round(STATE.pet.hunger)}% · Thirst ${Math.round(STATE.pet.thirst)}% · ${medals} state medal${medals === 1 ? '' : 's'}`);
  }
  return lines.join('\n');
}

async function shareDaySnapshot() {
  const text = buildDayShareSnapshot(UI.shareDayDate || todayISO(), STATE.uiPrefs.dayShareSections);
  if (!text) { toast('Choose something to include first.'); return; }
  if (!navigator.share) { await copyDaySnapshot(); toast('Sharing is not supported here, so the snapshot was copied instead.'); return; }
  try {
    await navigator.share({ title: `Forge day — ${UI.shareDayDate || todayISO()}`, text });
  } catch (error) {
    if (error?.name !== 'AbortError') { console.error(error); toast('Could not open the share sheet. Try Copy text instead.'); }
  }
}

async function copyDaySnapshot() {
  const text = buildDayShareSnapshot(UI.shareDayDate || todayISO(), STATE.uiPrefs.dayShareSections);
  if (!text) { toast('Choose something to include first.'); return; }
  try { await navigator.clipboard.writeText(text); toast('Day snapshot copied.'); }
  catch (error) { console.error(error); toast('Could not copy automatically. Try the Share button instead.'); }
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
  markOnboarding('themePresetSelected');
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
  markOnboarding('themeShapeChanged');
  persist();
}

function updateThemeField(key, value) {
  STATE.theme[key] = value;
  STATE.theme.preset = 'custom';
  if (key === 'font') markOnboarding('themeFontChanged');
  persist(); render();
}

const SUPPORT_EMAIL = 'ForgeTrainingLog@gmail.com';
function openSupportEmail() {
  const message = String(document.getElementById('support-message')?.value || '').trim();
  const subject = 'Forge Training Log support';
  const body = `${message}${message ? '\n\n' : ''}App version: ${APP_VERSION}\nPage: ${UI.route}\n\nPlease attach screenshots only if you choose to.`;
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copySupportEmail() {
  try { await navigator.clipboard.writeText(SUPPORT_EMAIL); toast('Support email copied.'); }
  catch (e) { toast(`Copy this address: ${SUPPORT_EMAIL}`); }
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
    const { data, compressed } = await compressToBase64(JSON.stringify(buildPortableTransferState()));
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
    const { data } = await compressToBase64(JSON.stringify(buildPortableTransferState()));
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

/* ---------- Direct QR transfer ----------
   QR is intentionally a short-range snapshot option, not an unbounded backup
   transport. Rebuildable food-search caches are excluded, and a transfer is
   capped at six frames. Larger histories route users to native file sharing,
   export, or a smaller recent/setup snapshot instead of demanding hundreds
   of scans. */
const QR_TRANSFER_PREFIX = 'FORGEQR1';
const QR_TRANSFER_CHUNK_SIZE = 1200;
const QR_TRANSFER_MAX_PARTS = 6;
let _qrReceiveParts = null;
let _qrReceiveReader = null;
let _qrReceiveControls = null;
let _qrLastText = '';

function filterTransferDates(record, cutoff) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  return Object.fromEntries(Object.entries(record).filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && (!cutoff || date >= cutoff)));
}

function buildPortableTransferState(historyDays = null) {
  const portable = JSON.parse(JSON.stringify(STATE));
  // USDA results can always be fetched again and commonly outweigh the actual
  // user-entered history after only a few days.
  portable.usdaCache = {};
  portable.foodIndexPool = [];
  if (historyDays == null) return portable;

  let cutoff = null;
  if (historyDays > 0) {
    const date = new Date(todayISO() + 'T00:00:00');
    date.setDate(date.getDate() - (historyDays - 1));
    cutoff = dateToLocalISO(date);
  }
  const scopedDates = record => historyDays === 0 ? {} : filterTransferDates(record, cutoff);
  portable.workoutLog = scopedDates(portable.workoutLog);
  if (portable.workoutLogMeta) portable.workoutLogMeta = scopedDates(portable.workoutLogMeta);
  portable.foodLog = scopedDates(portable.foodLog);
  portable.dailyCheckins = scopedDates(portable.dailyCheckins);
  portable.dailyWater = scopedDates(portable.dailyWater);
  portable.weightLog = historyDays > 0
    ? portable.weightLog.filter(entry => entry && entry.date >= cutoff)
    : [];
  portable.pet.rewardedDates = scopedDates(portable.pet.rewardedDates);
  portable.pet.rewardedWeeks = scopedDates(portable.pet.rewardedWeeks);
  portable.pet.foodRewardedDates = scopedDates(portable.pet.foodRewardedDates);
  portable.pet.waterRewardedDates = scopedDates(portable.pet.waterRewardedDates);
  portable.pet.travel.processedSteps = scopedDates(portable.pet.travel.processedSteps);
  return portable;
}

async function startQrTransferSend(historyDays = null) {
  try {
    const portable = buildPortableTransferState(historyDays);
    const { data } = await compressToBase64(JSON.stringify(portable));
    const transferId = Math.random().toString(36).slice(2, 10);
    const chunks = [];
    for (let i = 0; i < data.length; i += QR_TRANSFER_CHUNK_SIZE) chunks.push(data.slice(i, i + QR_TRANSFER_CHUNK_SIZE));
    UI.qrFullPartCount = chunks.length;
    UI.qrScopeLabel = historyDays == null ? 'Portable full history' : historyDays > 0 ? `Last ${historyDays} days` : 'Setup and current status';
    UI.qrExpanded = false;
    if (chunks.length > QR_TRANSFER_MAX_PARTS) {
      UI.qrPayloadParts = [];
      UI.qrPartIndex = 0;
      UI.qrTransferMode = 'too-large';
      render();
      return;
    }
    UI.qrPayloadParts = chunks.map((chunk, index) => `${QR_TRANSFER_PREFIX}|${transferId}|${index + 1}|${chunks.length}|${chunk}`);
    UI.qrPartIndex = 0;
    UI.qrTransferMode = 'send';
    UI.qrStatus = '';
    render();
    requestAnimationFrame(renderCurrentQrPart);
  } catch (error) {
    console.error(error);
    toast('Could not prepare the QR transfer. Try Copy sync code instead.');
  }
}

function renderQrTransferPanel() {
  if (UI.qrTransferMode === 'send') {
    const total = UI.qrPayloadParts.length;
    return `<div class="qr-transfer-panel ${UI.qrExpanded ? 'qr-display-expanded' : ''}">
      <div class="card-title">${escapeAttr(UI.qrScopeLabel || 'Forge transfer')} · show the receiving device</div>
      <div id="forge-qr-code" class="qr-code-box" aria-label="Transfer QR code part ${UI.qrPartIndex + 1} of ${total}"></div>
      <div class="qr-part-controls">
        <button class="btn btn-sm" onclick="changeQrTransferPart(-1)" ${UI.qrPartIndex <= 0 ? 'disabled' : ''}>← Previous</button>
        <strong>Part ${UI.qrPartIndex + 1} of ${total}</strong>
        <button class="btn btn-sm" onclick="changeQrTransferPart(1)" ${UI.qrPartIndex >= total - 1 ? 'disabled' : ''}>Next →</button>
      </div>
      <p class="hint">Parts scan in any order and duplicates are ignored. For glare, use Large view, clean the camera lens, and angle one screen slightly instead of pointing both screens straight at each other. Only show these personal-data codes to a device you trust.</p>
      <div class="qr-panel-actions"><button class="btn btn-sm" onclick="toggleQrDisplaySize()">${UI.qrExpanded ? 'Exit large view' : 'Large high-contrast view'}</button><button class="btn btn-ghost btn-sm" onclick="closeQrTransfer()">Done</button></div>
    </div>`;
  }
  if (UI.qrTransferMode === 'too-large') {
    return `<div class="qr-transfer-panel" role="status">
      <div class="card-title">${escapeAttr(UI.qrScopeLabel)} is too large for a reasonable QR transfer</div>
      <p class="hint">It would require ${UI.qrFullPartCount} codes. Forge caps QR at ${QR_TRANSFER_MAX_PARTS}; use <strong>Share to another device</strong> or <strong>Export backup</strong> above for the complete history.</p>
      <div class="qr-panel-actions">
        <button class="btn btn-primary btn-sm" onclick="startQrTransferSend(30)">Try last 30 days</button>
        <button class="btn btn-sm" onclick="startQrTransferSend(0)">Send setup/current status</button>
        <button class="btn btn-ghost btn-sm" onclick="closeQrTransfer()">Cancel</button>
      </div>
    </div>`;
  }
  return `<div class="qr-transfer-panel">
    <div class="card-title">Scan the sending device</div>
    <p id="qr-receive-status" class="hint">${escapeAttr(UI.qrStatus || 'Point your camera at a numbered part. If glare blocks it, tilt the sending screen slightly and keep the QR large.')}</p>
    <video id="qr-transfer-video" class="qr-transfer-video" muted playsinline></video>
    <div class="qr-receive-progress"><div id="qr-receive-progress-fill"></div></div>
    <button class="btn btn-ghost btn-sm" onclick="closeQrTransfer()">Cancel</button>
  </div>`;
}

function toggleQrDisplaySize() {
  UI.qrExpanded = !UI.qrExpanded;
  render();
  requestAnimationFrame(renderCurrentQrPart);
}

function renderCurrentQrPart() {
  const holder = document.getElementById('forge-qr-code');
  const text = UI.qrPayloadParts[UI.qrPartIndex];
  if (!holder || !text || typeof qrcode !== 'function') return;
  try {
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();
    holder.innerHTML = code.createSvgTag(4, 4);
  } catch (error) {
    console.error(error);
    holder.textContent = 'This transfer part could not be rendered. Use Copy sync code instead.';
  }
}

function changeQrTransferPart(delta) {
  UI.qrPartIndex = Math.max(0, Math.min(UI.qrPayloadParts.length - 1, UI.qrPartIndex + delta));
  render();
  requestAnimationFrame(renderCurrentQrPart);
}

function openQrTransferReceiver() {
  UI.qrTransferMode = 'receive';
  UI.qrStatus = 'Starting camera…';
  _qrReceiveParts = { transferId: null, total: 0, chunks: new Map() };
  _qrLastText = '';
  render();
  startQrReceiveScanner();
}

async function startQrReceiveScanner() {
  try {
    await loadZXing();
    const video = document.getElementById('qr-transfer-video');
    if (!video || UI.qrTransferMode !== 'receive') return;
    const Reader = ZXingBrowser.BrowserQRCodeReader || ZXingBrowser.BrowserMultiFormatReader;
    _qrReceiveReader = new Reader(undefined, { delayBetweenScanAttempts: 150 });
    _qrReceiveControls = await _qrReceiveReader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
      video,
      result => { if (result) handleQrTransferText(result.getText()); }
    );
    updateQrReceiveStatus('Camera ready. Scan each numbered part.');
  } catch (error) {
    console.error(error);
    const message = error?.name === 'NotAllowedError'
      ? 'Camera access was denied. Allow it and try again, or use Copy sync code.'
      : `Could not start the QR scanner (${error?.message || 'unknown error'}).`;
    updateQrReceiveStatus(message);
  }
}

async function handleQrTransferText(text) {
  if (!text || text === _qrLastText || !_qrReceiveParts) return;
  _qrLastText = text;
  setTimeout(() => { if (_qrLastText === text) _qrLastText = ''; }, 800);
  const match = /^FORGEQR1\|([a-z0-9]{4,16})\|(\d+)\|(\d+)\|([\s\S]+)$/.exec(text);
  if (!match) { updateQrReceiveStatus('That is not a Forge transfer QR code.'); return; }
  const [, transferId, partText, totalText, chunk] = match;
  const part = Number(partText), total = Number(totalText);
  if (total < 1 || total > 500 || part < 1 || part > total) { updateQrReceiveStatus('That transfer code has invalid part numbers.'); return; }
  if (_qrReceiveParts.transferId && _qrReceiveParts.transferId !== transferId) {
    updateQrReceiveStatus('This code belongs to a different transfer. Continue with the original sending device.');
    return;
  }
  _qrReceiveParts.transferId = transferId;
  _qrReceiveParts.total = total;
  _qrReceiveParts.chunks.set(part, chunk);
  const received = _qrReceiveParts.chunks.size;
  updateQrReceiveStatus(`Received ${received} of ${total}. ${received < total ? 'Show another part.' : 'Preparing import…'}`, received / total);
  if (received !== total) return;

  stopQrReceiveScanner();
  try {
    const joined = Array.from({ length: total }, (_, index) => _qrReceiveParts.chunks.get(index + 1)).join('');
    const parsed = await decompressFromText(joined);
    if (!window.confirm(`All ${total} QR part${total === 1 ? '' : 's'} received. Merge this backup into the data on this device?`)) {
      updateQrReceiveStatus('Import cancelled.');
      return;
    }
    STATE = mergeImportedState(parsed);
    persist();
    UI.qrTransferMode = null;
    render();
    toast('QR transfer imported and merged.');
  } catch (error) {
    console.error(error);
    updateQrReceiveStatus('All parts were read, but the backup could not be decoded. Start a new transfer and try again.');
  }
}

function updateQrReceiveStatus(message, progress) {
  UI.qrStatus = message;
  const status = document.getElementById('qr-receive-status');
  if (status) status.textContent = message;
  const fill = document.getElementById('qr-receive-progress-fill');
  if (fill && Number.isFinite(progress)) fill.style.width = `${Math.round(progress * 100)}%`;
}

function stopQrReceiveScanner() {
  if (_qrReceiveControls) { try { _qrReceiveControls.stop(); } catch (error) { /* already stopped */ } }
  _qrReceiveControls = null;
  _qrReceiveReader = null;
}

function closeQrTransfer() {
  stopQrReceiveScanner();
  UI.qrTransferMode = null;
  UI.qrPayloadParts = [];
  UI.qrPartIndex = 0;
  UI.qrScopeLabel = '';
  UI.qrFullPartCount = 0;
  UI.qrExpanded = false;
  _qrReceiveParts = null;
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(buildPortableTransferState(), null, 2)], { type: 'application/json' });
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
