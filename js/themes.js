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
      <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">fdc.nal.usda.gov/api-key-signup.html</a> and paste it below. Stored only in this browser.</p>
      <div class="field" style="max-width:360px;">
        <label>USDA API key</label>
        <input type="text" data-focus-id="usda-key" value="${escapeAttr(STATE.foodApiKey)}" placeholder="DEMO_KEY (default)" oninput="updateFoodApiKey(this.value)">
      </div>
    </div>

    <div class="card">
      <div class="card-title">Your data</div>
      <p class="hint" style="margin-bottom:12px;">Everything lives in this browser's local storage, nothing is sent anywhere except food searches. Export a backup to move data to another device, or import one back in.</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn" onclick="exportData()">Export backup (.json)</button>
        <button class="btn" onclick="document.getElementById('import-file-input').click()">Import backup (.json)</button>
        <input type="file" id="import-file-input" accept="application/json,.json" style="display:none;" onchange="importData(event)">
        <button class="btn btn-danger" onclick="resetAllData()">Reset all data</button>
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
      STATE = deepMerge(defaultState(), parsed);
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

function resetAllData() {
  if (!confirm('This will permanently delete all local data. Continue?')) return;
  STATE = defaultState();
  persist();
  UI.route = 'home';
  render();
}
