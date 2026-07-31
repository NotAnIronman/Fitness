/* ============================================================
   BODY FAT VIEW
   Education + a tape-measure (US Navy method) calculator. Most
   people have never actually measured this and tend to assume
   they're leaner than they are, this page is meant to inform
   plainly and kindly, not to alarm or to coddle.
   ============================================================ */

function renderBodyFat() {
  const p = STATE.profile;
  const bf = STATE.bodyFat;
  const isImperial = p.unitSystem === 'imperial';
  const toDisplay = cm => cm == null ? '' : (isImperial ? cmToIn(cm).toFixed(1) : cm.toFixed(1));

  const result = calcNavyBodyFat({ sex: p.sex, waistCm: bf.waistCm, neckCm: bf.neckCm, hipCm: bf.hipCm, heightCm: p.heightCm });
  const measurementError = getNavyMeasurementError({ sex: p.sex, waistCm: bf.waistCm, neckCm: bf.neckCm, hipCm: bf.hipCm, heightCm: p.heightCm });
  const category = result != null ? getBodyFatCategory(result, p.sex) : null;
  const bands = BODY_FAT_CATEGORIES[p.sex] || BODY_FAT_CATEGORIES.female;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Body composition</p>
      <h1 class="page-title">Body fat percentage</h1>
      <p class="page-sub">Weight alone does not separate fat mass from lean mass. A consistent tape measurement can provide a rough estimate and, more usefully, a trend over time.</p>
    </div>

    ${notice('bf-why-worth-knowing', `
      <strong>Why this is worth knowing:</strong> Two people can weigh the same and look completely different, because weight
      doesn't separate muscle from fat. A body-fat estimate adds context, but no field method is perfectly accurate. Use the same
      method and conditions each time and focus on the trend alongside strength, waist measurements, health, and how you feel.
      This isn't about judgment: bodies vary a lot, and a number here does not define health or worth.
    `)}

    <div class="card">
      <div class="card-title">
        Estimate yours (tape measure method)
        ${tip('ⓘ', 'About this method', 'The US Navy circumference method estimates body fat from a few tape measurements. It is not as precise as a DEXA scan or BodPod, but it is free, repeatable, and good enough to track your own trend over months.')}
      </div>
      <p class="hint" style="margin-bottom:14px;">You'll need a flexible tape measure. Measure snug but not tight, and measure at the same time of day for consistent tracking (mornings, before eating, tend to be most consistent).</p>

      <div class="grid grid-3">
        <div class="field">
          <label>Neck ${isImperial ? '(in)' : '(cm)'} <span class="hint" style="display:inline;">below the larynx</span></label>
          <input type="number" data-focus-id="bf-neck" step="0.1" value="${toDisplay(bf.neckCm)}" onchange="updateBodyFatField('neckCm', this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        <div class="field">
          <label>Waist ${isImperial ? '(in)' : '(cm)'} <span class="hint" style="display:inline;">at the navel</span></label>
          <input type="number" data-focus-id="bf-waist" step="0.1" value="${toDisplay(bf.waistCm)}" onchange="updateBodyFatField('waistCm', this.value)" onkeydown="if(event.key==='Enter') this.blur()">
        </div>
        ${p.sex === 'female' ? `
          <div class="field">
            <label>Hip ${isImperial ? '(in)' : '(cm)'} <span class="hint" style="display:inline;">widest point</span></label>
            <input type="number" data-focus-id="bf-hip" step="0.1" value="${toDisplay(bf.hipCm)}" onchange="updateBodyFatField('hipCm', this.value)" onkeydown="if(event.key==='Enter') this.blur()">
          </div>
        ` : ''}
      </div>

      ${!p.heightCm ? `<div class="section-note">Add your height on the Home page too, the formula needs it.</div>` : ''}
      ${measurementError ? `<div class="section-note">${escapeAttr(measurementError)}</div>` : ''}

      ${result != null ? `
        <hr class="div">
        <div class="grid grid-2">
          <div class="stat">
            <div class="stat-label">Estimated body fat</div>
            <div class="stat-value accent">${result.toFixed(1)}<span class="unit">%</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">Category</div>
            <div class="stat-value" style="font-size:20px;">${category.label}</div>
          </div>
        </div>
        <p class="hint" style="margin-top:10px; font-size:13px; line-height:1.6;">${category.note}</p>
      ` : `<p class="hint" style="margin-top:14px;">Fill in the measurements above to see your estimate.</p>`}
    </div>

    <div class="card">
      <div class="card-title">Category reference (${p.sex === 'male' ? 'men' : 'women'})</div>
      <table class="bf-table">
        <thead><tr><th>Category</th><th>Range</th><th>What it typically means</th></tr></thead>
        <tbody>
          ${bands.map(b => `
            <tr class="${category && category.label === b.label ? 'current-row' : ''}">
              <td>${b.label}</td>
              <td>${b.min}-${b.max === 100 ? b.min + '+' : b.max}%</td>
              <td style="color:var(--text-dim); font-size:12.5px;">${b.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="hint" style="margin-top:10px;">These are broad fitness-oriented reference bands, not diagnostic cutoffs. Age, measurement error, training history, genetics, and clinical context all matter.</p>
    </div>

    ${notice('bf-bmi-note', `
      <strong>A word on BMI:</strong> BMI is a screening measure, not a diagnosis. It does not distinguish muscle from fat and can
      misrepresent some individuals, especially highly muscular people. Tape-based body-fat estimates also have error. For personal
      decisions, look at several signals together: weight trend, waist trend, fitness, blood pressure/labs when available, and clinician context.
    `)}
  `;
}

function updateBodyFatField(field, value) {
  const n = numOrNull(value);
  if (n != null && n <= 0) { toast('Enter a measurement greater than zero.'); render(); return; }
  const isImperial = STATE.profile.unitSystem === 'imperial';
  STATE.bodyFat[field] = n != null ? (isImperial ? inToCm(n) : n) : null;
  persist(); render();
}
