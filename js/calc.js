/* ============================================================
   CALCULATIONS
   ============================================================ */

// --- Unit conversions ---
const kgToLb = kg => kg * 2.20462262185;
const lbToKg = lb => lb / 2.20462262185;
const cmToIn = cm => cm / 2.54;
const inToCm = inch => inch * 2.54;

// --- BMR: Mifflin-St Jeor equation ---
function calcBMR({ sex, age, heightCm, weightKg }) {
  if (!age || !heightCm || !weightKg) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

// --- Exercise calorie burn ---
// Standard formula: kcal = MET * 3.5 * weightKg / 200 * minutes
function metCalories(met, weightKg, minutes) {
  if (!met || !weightKg || !minutes) return 0;
  return (met * 3.5 * weightKg / 200) * minutes;
}

// Sets/reps/weight exercises: weight can be entered as total load, or per arm/side
// (e.g. a single dumbbell). This converts to a total-load figure for the calc.
function effectiveLoadKg(entry) {
  const w = Number(entry.weightKg) || 0;
  return entry.weightIsPerSide ? w * 2 : w;
}

// Estimate an effective duration for strength sets (time under tension + rest)
// ~ each rep takes ~3.5s of work, plus a portion of rest credited at low intensity.
function estimateStrengthMinutes(sets, reps) {
  if (!sets || !reps) return 0;
  const workSeconds = sets * reps * 3.5;
  const restSeconds = sets * 60 * 0.4; // count 40% of a ~60s rest as low-level active time
  return (workSeconds + restSeconds) / 60;
}

// Compute calories for a single logged exercise entry.
// entry: { exerciseId, sets, reps, weightKg, weightIsPerSide, durationMin, distanceKm }
function calcExerciseCalories(entry, bodyWeightKg) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === entry.exerciseId) || entry.custom;
  if (!ex || !bodyWeightKg) return 0;
  let minutes = 0;
  if (ex.inputMode === 'duration') {
    minutes = Number(entry.durationMin) || 0;
  } else if (ex.inputMode === 'setsRepsWeight' || ex.inputMode === 'setsReps') {
    minutes = estimateStrengthMinutes(Number(entry.sets), Number(entry.reps));
    // small intensity bump if lifting heavy relative to bodyweight
    if (ex.inputMode === 'setsRepsWeight') {
      const totalLoad = effectiveLoadKg(entry);
      const ratio = totalLoad / bodyWeightKg;
      if (ratio > 1) minutes *= 1.15;
    }
  } else if (ex.inputMode === 'distance') {
    minutes = Number(entry.durationMin) || 0;
  }
  return metCalories(ex.met, bodyWeightKg, minutes);
}

// --- Step calories: baseline vs. bonus ---
// Each activity level already assumes a "baseline" amount of daily walking is baked
// into its multiplier. Counting all steps again on top of that would double count.
// Instead, only steps ABOVE that baseline are converted to a calorie bonus.
function calcBonusStepCalories(stepsPerDay, baselineSteps) {
  const extra = Math.max(0, (Number(stepsPerDay) || 0) - (baselineSteps || 0));
  return extra * 0.04; // ~0.04 kcal per step above baseline, a commonly used approximation
}

// Legacy full-step formula, kept for reference/possible future use (not used for totals
// anymore, since it double counted against the activity multiplier).
function calcStepCalories(steps, weightKg) {
  if (!steps || !weightKg) return 0;
  return steps * 0.00057 * weightKg;
}

// --- Public-health-informed feedback bands ---
function getSessionIntensityFeedback(kcal) {
  return EXERCISE_INTENSITY_BANDS.session.find(b => kcal <= b.max);
}
function getWeeklyIntensityFeedback(kcal) {
  return EXERCISE_INTENSITY_BANDS.weekly.find(b => kcal <= b.max);
}

// --- Auto-detect activity level from planner data ---
// Uses: number of workout days/week, avg session length, and steps/day.
function autoDetectActivityLevel({ workoutDaysPerWeek, avgSessionMinutes, stepsPerDay }) {
  let score = 0;
  if (stepsPerDay >= 12000) score += 2;
  else if (stepsPerDay >= 10000) score += 1.5;
  else if (stepsPerDay >= 7000) score += 1;
  else if (stepsPerDay >= 5000) score += 0.5;

  if (workoutDaysPerWeek >= 6) score += 2;
  else if (workoutDaysPerWeek >= 4) score += 1.5;
  else if (workoutDaysPerWeek >= 2) score += 1;
  else if (workoutDaysPerWeek >= 1) score += 0.5;

  if (avgSessionMinutes >= 75) score += 0.5;

  if (score >= 3.5) return ACTIVITY_LEVELS[4]; // very active
  if (score >= 2.5) return ACTIVITY_LEVELS[3]; // active
  if (score >= 1.3) return ACTIVITY_LEVELS[2]; // moderate
  if (score >= 0.4) return ACTIVITY_LEVELS[1]; // light
  return ACTIVITY_LEVELS[0]; // sedentary
}

function calcTDEE(bmr, activityMultiplier) {
  if (!bmr) return null;
  return bmr * activityMultiplier;
}

// --- Goal feasibility ---
// 1 lb of fat ~ 3500 kcal. Returns projected rate + a feasibility verdict (no fear-mongering, just a flag).
function evaluateGoal({ startWeightKg, targetWeightKg, startDate, targetDate, tdee }) {
  if (!startWeightKg || !targetWeightKg || !startDate || !targetDate) return null;
  const deltaKg = targetWeightKg - startWeightKg; // negative = loss
  const days = (new Date(targetDate) - new Date(startDate)) / 86400000;
  if (days <= 0) return { error: 'Target date must be after start date.' };

  const weeks = days / 7;
  const deltaLb = kgToLb(deltaKg);
  const ratePerWeekLb = deltaLb / weeks;
  const dailyDeficitNeeded = (Math.abs(deltaLb) * 3500) / days; // kcal/day required
  const suggestedIntake = tdee ? tdee - (deltaLb < 0 ? dailyDeficitNeeded : -dailyDeficitNeeded) : null;

  // Feasibility bands based on widely-cited safe rate of change (~0.5-1% bodyweight/week, capped ~2lb/week loss, ~0.5-1lb/week gain)
  const absRate = Math.abs(ratePerWeekLb);
  let feasibility = 'reasonable';
  if (deltaLb < 0) {
    if (absRate > 2.5) feasibility = 'unlikely';
    else if (absRate > 1.5) feasibility = 'ambitious';
  } else if (deltaLb > 0) {
    if (absRate > 1.5) feasibility = 'unlikely';
    else if (absRate > 0.75) feasibility = 'ambitious';
  }

  return {
    deltaLb, ratePerWeekLb, dailyDeficitNeeded, suggestedIntake, feasibility, weeks, days,
  };
}

// Progress percentage between start and target
function goalProgressPct(startWeightKg, currentWeightKg, targetWeightKg) {
  if (startWeightKg == null || currentWeightKg == null || targetWeightKg == null) return 0;
  const total = targetWeightKg - startWeightKg;
  if (total === 0) return 100;
  const done = currentWeightKg - startWeightKg;
  return Math.max(0, Math.min(100, (done / total) * 100));
}
