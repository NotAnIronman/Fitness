/* ============================================================
   FAQ + EXERCISE REFERENCE
   Each library exercise receives a stable anchor and a consistent content
   schema. Detailed videos/cues can be added incrementally without changing
   workout-plan or workout-log records.
   ============================================================ */

function exerciseGuideAnchor(exerciseId) {
  return `exercise-guide-${String(exerciseId || 'custom').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function exerciseGuideFormula(exercise) {
  if (exercise.inputMode === 'duration') {
    return `Duration estimate: MET ${exercise.met} × 3.5 × body weight (kg) ÷ 200 × completed active minutes${exercise.restAdjust && exercise.restAdjust < 1 ? ` × ${exercise.restAdjust} active-time adjustment` : ''}.`;
  }
  if (exercise.inputMode === 'setsRepsWeight') {
    return `Strength estimate: only completed repetitions count. Forge uses its deliberately conservative bodyweight-scaled kcal-per-rep estimate; load is recorded for progression but is not treated as a large calorie multiplier.`;
  }
  return `Repetition estimate: only completed repetitions count, using Forge's conservative bodyweight-scaled kcal-per-rep estimate.`;
}

function exerciseGuideDefaults(exercise) {
  const strength = exercise.category === 'Strength';
  const continuous = exercise.inputMode === 'duration';
  return {
    muscles: `Primary area in Forge: ${exercise.bodyPart || exercise.category}. Exact muscle contribution changes with technique, equipment, range of motion, and individual anatomy.`,
    know: strength
      ? `Use a load and range you can control. Consistent practice and goal-appropriate volume matter more than advanced techniques for most healthy adults.`
      : `Choose an intensity you can perform with the intended technique. Build duration or difficulty gradually enough that you can recover and repeat it.`,
    mistakes: strength
      ? `Using more load than can be controlled, changing the movement to finish a repetition, rushing the setup, or continuing through sharp or escalating pain.`
      : `Starting harder than can be sustained, allowing technique to deteriorate with fatigue, or increasing duration and intensity at the same time too quickly.`,
    cues: continuous
      ? `Begin below your maximum effort, settle into a repeatable rhythm, and finish with technique still under control.`
      : `Set a stable starting position, move through a controlled pain-free range, and stop the set when the intended position can no longer be maintained.`,
    regression: strength
      ? `Regression ideas: reduce load, use a supported or machine version, shorten range temporarily, or choose a simpler variation. Progression ideas: add repetitions, load, range, or weekly sets one variable at a time.`
      : `Regression ideas: reduce pace, resistance, impact, or duration. Progression ideas: gradually add duration, pace, resistance, or technical complexity one variable at a time.`,
  };
}

const GENERAL_FAQ_ITEMS = [
  {
    question: 'Why are there no accounts?',
    answer: `<p>Forge is useful without knowing who you are. The current app ecosystem already asks people to create enough logins and surrender enough data, and an account would not improve the core calculations or local tracking.</p><p>Your information therefore stays in this browser unless <em>you</em> choose to export, transfer, or share it. The tradeoff is that Forge cannot automatically restore data after a device is lost or cleared, so keep an occasional backup from Themes.</p>`,
  },
  {
    question: 'I follow a special diet or meal-timing window. Will Forge work for me?',
    answer: `<p>Usually, yes. Weight change still depends heavily on energy intake over time, so Forge can track calories and macros regardless of whether you eat early, late, intermittently, plant-based, low-carbohydrate, culturally specific, or otherwise.</p><p>Meal timing and food choice can still affect hunger, training performance, glucose management, digestion, nutrient adequacy, and how easy the diet is to follow. Use the method that fits your preferences and health needs, log honestly, and follow clinician guidance when a medical condition, pregnancy, medication, or eating-disorder history changes what is appropriate.</p>`,
  },
  {
    question: 'I have been dieting but am not seeing the result I expected. What should I check?',
    answer: `<p>First compare several weeks of consistent weigh-ins, not a few days. Water, sodium, carbohydrate intake, bowel contents, menstrual-cycle changes, and weigh-in timing can temporarily hide real fat loss or gain.</p><p>If the trend is still flat, audit the log before making a large calorie change. Cooking oils, sauces, drinks, bites, restaurant portions, serving counts, and copied database entries are common sources of error in either direction. A food scale and ingredient-by-ingredient meal entries can improve accuracy, but perfection is unnecessary. After two to four consistent weeks, make a small adjustment and review the next trend.</p>`,
  },
  {
    question: 'Where do Forge calculations and recommendations come from?',
    answer: `<p>Calculation panels explain their formulas, assumptions, and limitations where possible. Nutrition and activity guidance links to primary research, major scientific reviews, or public-health guidance, and the evidence list on Weight Goals makes the major planning rules auditable.</p><p>Not every number is a direct measurement: calorie burn, body-fat estimates, metabolic needs, and projected weight change are estimates. Exercise-guide cues are general education assembled from established training principles and practical experience; until an individual guide has a reviewed citation or demonstration, it should not be mistaken for personalized coaching, diagnosis, or rehabilitation advice.</p>`,
  },
  {
    question: 'How do I add Forge to my phone?',
    answer: `<p><strong>iPhone or iPad:</strong> Open Forge in Safari, tap the Share button, you may need to tap "More Options", choose <em>Add to Home Screen</em>, turn on <em>Open as Web App</em> if shown, then tap Add. Apple documents the current steps in its <a href="https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener noreferrer">iPhone web-app guide</a>.</p><p><strong>Android:</strong> Open Forge in Chrome, tap the three-dot menu, choose <em>Add to Home screen</em>, then <em>Install</em> or <em>Create shortcut</em> and follow the prompt. The exact label varies by browser and device; see <a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noopener noreferrer">Chrome's web-app instructions</a>.</p><p>Forge must be served over HTTPS for full PWA features. Installing it does not create a Forge account or move your existing local data to another browser.</p>`,
  },
];

function renderGeneralFAQ() {
  return `<div class="faq-general-list">${GENERAL_FAQ_ITEMS.map((item, index) => `<details class="card faq-question" ${index === 0 ? 'open' : ''}><summary>${escapeAttr(item.question)}</summary><div class="faq-answer">${item.answer}</div></details>`).join('')}</div>`;
}

function renderFAQ() {
  const query = String(UI.faqQuery || '').trim().toLowerCase();
  const exercises = EXERCISE_LIBRARY.filter(exercise => !query || `${exercise.name} ${exercise.bodyPart} ${exercise.category}`.toLowerCase().includes(query));
  return `<div class="page-head">
      <p class="page-eyebrow">Reference</p>
      <h1 class="page-title">FAQ & exercise guides</h1>
      <p class="page-sub">A searchable home for exercise demonstrations, cues, common mistakes, calorie formulas, and easier or harder variations.</p>
    </div>
    <div class="card faq-intro">
      <div class="card-title">How to use these guides</div>
      <p class="hint">These are general education, not diagnosis or individualized rehabilitation. Stop for sharp, sudden, or escalating pain and get qualified help when needed. Videos will be added only when a reviewed demonstration is available.</p>
      <p class="hint">Programming notes follow the current evidence that consistency and goal-specific load/volume matter more than unnecessary complexity. <a href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noopener noreferrer">ACSM 2026 resistance-training overview</a>.</p>
      <div class="field"><label>Find an exercise</label><input type="search" value="${escapeAttr(UI.faqQuery || '')}" placeholder="Bench Press, legs, mobility…" oninput="setFaqQuery(this.value)"></div>
    </div>
    ${renderGeneralFAQ()}
    <div class="section-heading"><h2>Exercise guides</h2><p class="hint">Choose an exercise to open its reference outline.</p></div>
    <div class="faq-guide-list">
      ${exercises.map(renderExerciseGuide).join('') || '<div class="card empty-state">No exercises match that search.</div>'}
    </div>`;
}

function renderExerciseGuide(exercise) {
  const guide = exerciseGuideDefaults(exercise);
  const selected = UI.faqExerciseId === exercise.id;
  return `<details class="card exercise-guide" id="${exerciseGuideAnchor(exercise.id)}" ${selected ? 'open' : ''}>
    <summary><span>${escapeAttr(exercise.name)}</span><span class="badge">${escapeAttr(exercise.bodyPart || exercise.category)}</span></summary>
    <div class="exercise-guide-body">
      <section><h3>Video demonstration</h3><p class="hint">Reviewed video coming soon.</p></section>
      <section><h3>Muscles used</h3><p>${escapeAttr(guide.muscles)}</p></section>
      <section><h3>Things to know</h3><p>${escapeAttr(guide.know)}</p></section>
      <section><h3>Common mistakes</h3><p>${escapeAttr(guide.mistakes)}</p></section>
      <section><h3>Cues</h3><p>${escapeAttr(guide.cues)}</p></section>
      <section><h3>Calorie formula</h3><p>${escapeAttr(exerciseGuideFormula(exercise))}</p></section>
      <section><h3>Regression and progression</h3><p>${escapeAttr(guide.regression)}</p></section>
    </div>
  </details>`;
}

function setFaqQuery(value) {
  UI.faqQuery = String(value || '').slice(0, 100);
  UI.faqExerciseId = null;
  renderSoon(250);
}

function openExerciseGuide(exerciseId) {
  if (!EXERCISE_LIBRARY.some(exercise => exercise.id === exerciseId)) return;
  UI.faqQuery = '';
  UI.faqExerciseId = exerciseId;
  navigate('faq');
}
