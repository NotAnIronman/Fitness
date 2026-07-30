/* ============================================================
   ACHIEVEMENTS
   Always available (not gated behind the secret pet setting), though
   unlocking one also awards pet points if the pet feature is on.
   ============================================================ */

// Idempotent: checks every achievement definition, unlocks any newly-met ones,
// awards their point value to the pet if enabled, and returns the newly
// unlocked list (for a toast). Safe to call on every render of this page.
function evaluateAchievements() {
  const ctx = buildGameContext();
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (STATE.achievements.unlocked[a.id]) return;
    let met = false;
    try { met = !!a.check(ctx); } catch (e) { met = false; }
    if (met) {
      STATE.achievements.unlocked[a.id] = todayISO();
      if (STATE.pet.enabled) {
        STATE.pet.points += a.points;
        STATE.pet.totalPointsEarned += a.points;
      }
      newlyUnlocked.push(a);
    }
  });
  if (newlyUnlocked.length) persist();
  return newlyUnlocked;
}

function renderAchievements() {
  const ctx = buildGameContext();
  const unlockedCount = Object.keys(STATE.achievements.unlocked).length;
  const categories = [...new Set(ACHIEVEMENTS.map(a => a.category))];

  return `
    <div class="page-head">
      <p class="page-eyebrow">Progress</p>
      <h1 class="page-title">Achievements</h1>
      <p class="page-sub">${unlockedCount} of ${ACHIEVEMENTS.length} unlocked. Milestones across steps, workouts, nutrition, and goals.</p>
    </div>

    <div class="card">
      <div class="progress-track"><div class="progress-fill" style="width:${(unlockedCount / ACHIEVEMENTS.length) * 100}%"></div></div>
      <div class="progress-labels"><span>0</span><span>${unlockedCount} / ${ACHIEVEMENTS.length}</span><span>${ACHIEVEMENTS.length}</span></div>
    </div>

    ${categories.map(cat => `
      <div class="card">
        <div class="card-title">${cat}</div>
        <div class="row-list">
          ${ACHIEVEMENTS.filter(a => a.category === cat).map(a => renderAchievementRow(a, ctx)).join('')}
        </div>
      </div>
    `).join('')}
  `;
}

function renderAchievementRow(a, ctx) {
  const unlockedDate = STATE.achievements.unlocked[a.id];
  const unlocked = !!unlockedDate;
  const prog = !unlocked && a.progress ? a.progress(ctx) : null;
  return `
    <div class="exercise-row" style="${unlocked ? '' : 'opacity:0.6;'}">
      <div>
        <div class="name">${unlocked ? '\u2713 ' : ''}${escapeAttr(a.name)}</div>
        <div class="meta">${escapeAttr(a.desc)}${unlocked ? ` \u00b7 unlocked ${unlockedDate}` : ''}</div>
        ${prog ? `
          <div class="macro-bar-track" style="margin-top:6px; max-width:180px;">
            <div class="macro-bar-fill" style="width:${Math.min(100, (prog.current / prog.target) * 100)}%; background:var(--accent-2);"></div>
          </div>
          <div class="meta" style="margin-top:2px;">${prog.current} / ${prog.target}</div>
        ` : ''}
      </div>
      <div class="kcal">${unlocked ? '' : `+${a.points}`}</div>
    </div>
  `;
}
