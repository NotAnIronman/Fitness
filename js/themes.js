/* ============================================================
   THEMES + SETTINGS VIEW
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
          <label>Corner radius: ${t.radius}px</label>
          <input type="range" min="0" max="24" value="${t.radius}" oninput="updateThemeField('radius', Number(this.value))">
        </div>
      </div>
      <div class="card">
        <div class="card-title">Typography</div>
        <div class="field">
          <label>Font pairing</label>
          <select onchange="updateThemeField('font', this.value)">
            ${fontOptions.map(f => `<option value="${f.key}" ${t.font === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Nutritionix API (optional)</div>
      <p class="hint" style="margin-bottom:12px;">Add your free Nutritionix keys to unlock full food search instead of the built-in offline list. Get keys at
        <a href="https://www.nutritionix.com/business/api" target="_blank" rel="noopener">nutritionix.com/business/api</a>. Keys are stored only in this browser.</p>
      <div class="field-row">
        <div class="field"><label>App ID</label><input type="text" value="${escapeAttr(STATE.nutritionixKeys.appId)}" oninput="updateNutritionixKey('appId', this.value)"></div>
        <div class="field"><label>App Key</label><input type="password" value="${escapeAttr(STATE.nutritionixKeys.appKey)}" oninput="updateNutritionixKey('appKey', this.value)"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Your data</div>
      <p class="hint" style="margin-bottom:12px;">Everything lives in this browser's local storage — nothing is sent anywhere. Export a backup or wipe the slate clean.</p>
      <div style="display:flex; gap:10px;">
        <button class="btn" onclick="exportData()">Export backup (.json)</button>
        <button class="btn btn-danger" onclick="resetAllData()">Reset all data</button>
      </div>
    </div>
  `;
}

function colorField(label, key, value) {
  return `
    <div class="field">
      <label>${label}</label>
      <input type="color" value="${value}" oninput="updateThemeField('${key}', this.value)">
    </div>
  `;
}

function applyPreset(key) {
  STATE.theme = themeFromPreset(key);
  persist(); render();
}

function updateThemeField(key, value) {
  STATE.theme[key] = value;
  STATE.theme.preset = 'custom';
  persist(); render();
}

function updateNutritionixKey(field, value) {
  STATE.nutritionixKeys[field] = value;
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

function resetAllData() {
  if (!confirm('This will permanently delete all local data. Continue?')) return;
  STATE = defaultState();
  persist();
  UI.route = 'home';
  render();
}
