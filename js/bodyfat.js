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
  const category = result != null ? getBodyFatCategory(result, p.sex) : null;
  const bands = BODY_FAT_CATEGORIES[p.sex] || BODY_FAT_CATEGORIES.female;

  return `
    <div class="page-head">
      <p class="page-eyebrow">Body composition</p>
      <h1 class="page-title">Body fat percentage</h1>
      <p class="page-sub">Weight alone doesn't say much about body composition. Most people have never actually measured their body fat percentage, and tend to assume it's lower than it really is. Here's how to find out for real.</p>
    </div>

    ${notice('bf-why-worth-knowing', `
      <strong>Why this is worth knowing:</strong> Two people can weigh the same and look completely different, because weight
      doesn't separate muscle from fat. Body fat percentage does. It's a more honest number than the scale or BMI, and knowing
      yours (even roughly) makes goals like "lose fat" or "get toned" concrete instead of vague. This isn't about judgment:
      bodies vary a lot, and a number here doesn't define your worth. It's just information you can act on if you want to.
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
          <input type="number" data-focus-id="bf-neck" step="0.1" value="${toDisplay(bf.neckCm)}" oninput="updateBodyFatField('neckCm', this.value)">
        </div>
        <div class="field">
          <label>Waist ${isImperial ? '(in)' : '(cm)'} <span class="hint" style="display:inline;">at the navel</span></label>
          <input type="number" data-focus-id="bf-waist" step="0.1" value="${toDisplay(bf.waistCm)}" oninput="updateBodyFatField('waistCm', this.value)">
        </div>
        ${p.sex === 'female' ? `
          <div class="field">
            <label>Hip ${isImperial ? '(in)' : '(cm)'} <span class="hint" style="display:inline;">widest point</span></label>
            <input type="number" data-focus-id="bf-hip" step="0.1" value="${toDisplay(bf.hipCm)}" oninput="updateBodyFatField('hipCm', this.value)">
          </div>
        ` : ''}
      </div>

      ${!p.heightCm ? `<div class="section-note">Add your height on the Home page too, the formula needs it.</div>` : ''}

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
      <p class="hint" style="margin-top:10px;">Ranges from the American Council on Exercise's commonly cited classification. Individual context (age, training history, genetics) matters too, this is a reference point, not a verdict.</p>
    </div>

    ${notice('bf-bmi-note', `
      <strong>A word on BMI:</strong> BMI (weight divided by height squared) is easy to calculate, which is why it's
      everywhere, but it can't tell muscle from fat. A muscular, lean athlete and someone with a higher body fat percentage
      can land on the exact same BMI. If you've ever heard your BMI and thought "that doesn't sound like me," you're not
      wrong to be skeptical, body fat percentage is almost always the more useful number for understanding your own body.
    `)}
  `;
}

function updateBodyFatField(field, value) {
  const n = numOrNull(value);
  const isImperial = STATE.profile.unitSystem === 'imperial';
  STATE.bodyFat[field] = n != null ? (isImperial ? inToCm(n) : n) : null;
  persist(); renderSoon();
}
