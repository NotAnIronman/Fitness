/* ============================================================
   GAME STATS
   Builds one shared "ctx" object of computed stats (streaks, counts,
   totals) used by both the pet point-reward system (js/pet.js) and
   the achievements evaluator (js/achievements.js), so the two stay
   consistent and the numbers only get computed once per check.
   ============================================================ */

// Longest run of consecutive calendar days in `qualifyingDates` (a Set/array of
// 'YYYY-MM-DD' strings) ending at today or yesterday. If the most recent
// qualifying day is more than 1 day old, the streak is considered broken (0),
// since a stale streak shouldn't still count as "current."
function computeCalendarStreak(qualifyingDates) {
  const set = qualifyingDates instanceof Set ? qualifyingDates : new Set(qualifyingDates);
  if (!set.size) return 0;
  const sorted = Array.from(set).sort();
  const mostRecent = sorted[sorted.length - 1];
  const daysSinceRecent = Math.round((new Date(todayISO()) - new Date(mostRecent)) / 86400000);
  if (daysSinceRecent > 1) return 0;
  let streak = 1;
  const cursor = new Date(mostRecent + 'T00:00:00');
  for (let i = sorted.length - 2; i >= 0; i--) {
    cursor.setDate(cursor.getDate() - 1);
    const expected = cursor.toISOString().slice(0, 10);
    if (sorted[i] === expected) streak++;
    else break;
  }
  return streak;
}

function buildGameContext() {
  // ---- Steps ----
  const checkinDates = Object.keys(STATE.dailyCheckins).sort();
  const checkinCount = checkinDates.length;
  const maxStepsDay = checkinDates.reduce((m, d) => Math.max(m, STATE.dailyCheckins[d].steps || 0), 0);
  const checkinStreak = computeCalendarStreak(checkinDates);
  // The last 7 CALENDAR days (not just "the last 7 check-in entries," which
  // could span months if check-ins are sporadic, and could be fooled by a
  // single check-in producing an "average" of just itself).
  let last7Sum = 0, last7CalendarDaysLogged = 0;
  const todayD = todayISO();
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayD + 'T00:00:00');
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (STATE.dailyCheckins[iso]) { last7Sum += STATE.dailyCheckins[iso].steps || 0; last7CalendarDaysLogged++; }
  }
  const last7DayAvgSteps = last7CalendarDaysLogged ? last7Sum / last7CalendarDaysLogged : 0;

  // ---- Workouts ----
  const logDatesWithExercises = Object.keys(STATE.workoutLog).filter(d => STATE.workoutLog[d].length > 0);
  const totalExercisesLogged = Object.values(STATE.workoutLog).reduce((s, arr) => s + arr.length, 0);
  const workoutStreak = computeCalendarStreak(logDatesWithExercises);
  const bodyPartsSet = new Set();
  let usedPerSetWeights = false;
  Object.values(STATE.workoutLog).forEach(arr => arr.forEach(e => {
    const ex = EXERCISE_LIBRARY.find(x => x.id === e.exerciseId) || e.custom;
    if (ex && ex.bodyPart) bodyPartsSet.add(ex.bodyPart);
    if (e.perSetWeights && e.perSetWeights.length) usedPerSetWeights = true;
  }));
  let hasPersonalRecord = false;
  if (typeof getLoggedExerciseOptions === 'function') {
    getLoggedExerciseOptions().forEach(opt => {
      const hist = getExerciseHistory(opt.key);
      if (hist.length >= 2 && hist[hist.length - 1].value > hist[0].value) hasPersonalRecord = true;
    });
  }
  const activeplanDays = STATE.workoutPlan.days.filter(d => d.exercises.length > 0).length;

  // ---- Nutrition ----
  const foodDates = Object.keys(STATE.foodLog).filter(d => STATE.foodLog[d].length > 0);
  const totalFoodDaysLogged = foodDates.length;
  const target = (typeof getFoodTargetCalories === 'function') ? getFoodTargetCalories() : null;
  const onTargetDateSet = new Set();
  let maxItemsInADay = 0;
  foodDates.forEach(d => {
    const entries = STATE.foodLog[d];
    maxItemsInADay = Math.max(maxItemsInADay, entries.length);
    if (target) {
      const kcal = entries.reduce((s, e) => s + e.kcal * e.qty, 0);
      if (Math.abs(kcal - target) <= target * 0.15) onTargetDateSet.add(d);
    }
  });
  const onTargetDays = onTargetDateSet.size;
  const onTargetStreak = computeCalendarStreak(onTargetDateSet);
  const savedMealsCount = STATE.savedMeals.length;

  // ---- Weight & goals ----
  const weightLogCount = STATE.weightLog.length;
  const weightStreak = computeCalendarStreak(STATE.weightLog.map(e => e.date));
  const hasGoal = STATE.goal.targetWeightKg != null && !!STATE.goal.targetDate;
  const goalReached = hasGoal && goalProgressPct(STATE.goal.startWeightKg ?? currentWeightKg(), currentWeightKg(), STATE.goal.targetWeightKg) >= 100;

  // ---- Profile ----
  const profileComplete = !!(STATE.profile.age && STATE.profile.heightCm && STATE.profile.weightKg);
  const bodyFatCalculated = typeof calcNavyBodyFat === 'function' && calcNavyBodyFat({
    sex: STATE.profile.sex, waistCm: STATE.bodyFat.waistCm, neckCm: STATE.bodyFat.neckCm,
    hipCm: STATE.bodyFat.hipCm, heightCm: STATE.profile.heightCm,
  }) != null;

  // ---- Pet ----
  const hasPet = !!STATE.pet.species;
  const ownedItemsCount = STATE.pet.ownedItems.length;
  const slotsEquipped = Object.values(STATE.pet.equipped).filter(Boolean).length;
  const totalPointsEarned = STATE.pet.totalPointsEarned;

  return {
    checkinCount, maxStepsDay, checkinStreak, last7DayAvgSteps, last7CalendarDaysLogged,
    totalExercisesLogged, workoutStreak, bodyPartsTouched: bodyPartsSet.size, usedPerSetWeights, hasPersonalRecord, activeplanDays,
    totalFoodDaysLogged, onTargetDays, onTargetStreak, savedMealsCount, maxItemsInADay,
    weightLogCount, weightStreak, hasGoal, goalReached,
    profileComplete, bodyFatCalculated,
    hasPet, ownedItemsCount, slotsEquipped, totalPointsEarned,
  };
}
