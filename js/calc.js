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
// (e.g. a single dumbbell), or as a different weight per set (e.g. ramping sets).
// This converts to a single "top load" figure used for the calc and progress chart.
function effectiveLoadKg(entry) {
  if (entry.perSetWeights && entry.perSetWeights.length) {
    return Math.max(...entry.perSetWeights.map(s => {
      const w = Number(s.weightKg) || 0;
      return s.weightIsPerSide ? w * 2 : w;
    }));
  }
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

// Same idea, but reading per-set rep counts when the entry uses different
// weights/reps per set instead of one aggregate sets x reps figure.
function estimateStrengthMinutesFromEntry(entry) {
  if (entry.perSetWeights && entry.perSetWeights.length) {
    let totalSeconds = 0;
    entry.perSetWeights.forEach(set => {
      totalSeconds += (Number(set.reps) || 0) * 3.5 + 60 * 0.4;
    });
    return totalSeconds / 60;
  }
  return estimateStrengthMinutes(Number(entry.sets), Number(entry.reps));
}

// Compute calories for a single logged exercise entry.
// entry: { exerciseId, sets, reps, weightKg, weightIsPerSide, perSetWeights, durationMin }
function calcExerciseCalories(entry, bodyWeightKg) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === entry.exerciseId) || entry.custom;
  if (!ex || !bodyWeightKg) return 0;
  let minutes = 0;
  if (ex.inputMode === 'duration') {
    minutes = Number(entry.durationMin) || 0;
    // Duration-based STRENGTH entries (e.g. "general gym session") are mostly rest
    // between sets, not continuous effort - scale down unless the exercise says
    // otherwise (restAdjust defaults to 1, i.e. no adjustment, for cardio/mobility).
    if (ex.category === 'Strength' && typeof ex.restAdjust === 'number') {
      minutes *= ex.restAdjust;
    }
  } else if (ex.inputMode === 'setsRepsWeight' || ex.inputMode === 'setsReps') {
    minutes = estimateStrengthMinutesFromEntry(entry);
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

// --- Body fat %: US Navy circumference method ---
// A widely used tape-measure estimate (not as accurate as DEXA/BodPod, but free,
// repeatable, and good enough to track trend over time). Constants are calibrated
// for inches, so cm inputs are converted internally.
function calcNavyBodyFat({ sex, waistCm, neckCm, hipCm, heightCm }) {
  if (!waistCm || !neckCm || !heightCm) return null;
  if (sex === 'female' && !hipCm) return null;
  const waist = cmToIn(waistCm), neck = cmToIn(neckCm), height = cmToIn(heightCm);
  const hip = hipCm ? cmToIn(hipCm) : 0;
  let bf;
  if (sex === 'male') {
    const diff = waist - neck;
    if (diff <= 0) return null;
    bf = 86.010 * Math.log10(diff) - 70.041 * Math.log10(height) + 36.76;
  } else {
    const diff = waist + hip - neck;
    if (diff <= 0) return null;
    bf = 163.205 * Math.log10(diff) - 97.684 * Math.log10(height) - 78.387;
  }
  return Math.max(2, Math.min(60, bf));
}

function getBodyFatCategory(bf, sex) {
  const bands = BODY_FAT_CATEGORIES[sex] || BODY_FAT_CATEGORIES.female;
  return bands.find(b => bf >= b.min && bf <= b.max) || bands[bands.length - 1];
}
// Finds the current band and how much more (in kcal) would reach the next one up.
function getNextTierGap(kcal, bands) {
  const idx = bands.findIndex(b => kcal <= b.max);
  if (idx === -1 || idx === bands.length - 1) return null; // already at the top band
  const next = bands[idx + 1];
  const gapKcal = Math.max(1, Math.ceil(bands[idx].max - kcal + 1));
  return { nextLabel: next.label, gapKcal };
}

// --- Energy expenditure breakdown: BMR / NEAT / TEF / EAT ---
// A commonly cited rough split of total daily energy expenditure:
//  - BMR is usually ~60-70% of TDEE for most people
//  - TEF (thermic effect of food, digesting/processing what you eat) is
//    approximated here as ~10% of TDEE, a widely used rule of thumb
//  - EAT (exercise activity thermogenesis) is calories from planned workouts
//  - NEAT (non-exercise activity thermogenesis: walking around, fidgeting,
//    chores, standing) is whatever's left over, this is often the most
//    under-counted piece of someone's day
function getEnergyBreakdown({ bmr, tdee, dailyExerciseKcal }) {
  if (!bmr || !tdee) return null;
  const tef = tdee * 0.10;
  const eat = Math.min(dailyExerciseKcal || 0, tdee - bmr); // can't exceed remaining budget
  const neat = Math.max(0, tdee - bmr - tef - eat);
  return {
    bmr, tef, eat, neat, tdee,
    bmrPct: (bmr / tdee) * 100,
    tefPct: (tef / tdee) * 100,
    eatPct: (eat / tdee) * 100,
    neatPct: (neat / tdee) * 100,
  };
}

// --- Food intake safety check ---
// Flags dangerously low logged intake. This is a coarse rule-of-thumb floor, not
// personalized medical advice, intended to catch clearly-too-low days (e.g. a few
// hundred calories) rather than fine-tune anyone's specific target.
function checkIntakeSafety(loggedKcal, sex) {
  const floor = MIN_SAFE_INTAKE[sex] || MIN_SAFE_INTAKE.female;
  if (loggedKcal > 0 && loggedKcal < floor) {
    return {
      severe: loggedKcal < floor * 0.6,
      floor,
    };
  }
  return null;
}

// --- Strength standard ranking ---
// exerciseId must be a key in STRENGTH_STANDARDS (load-based, pass valueKg) or
// STRENGTH_STANDARDS_REPS (rep-based bodyweight moves, pass reps). Returns null
// if we don't have a reference for that particular exercise.
function getStrengthStanding({ exerciseId, valueKg, reps, bodyweightKg, sex }) {
  const sexKey = sex === 'male' ? 'male' : 'female';
  if (STRENGTH_STANDARDS[exerciseId] && bodyweightKg && valueKg != null) {
    const levels = STRENGTH_STANDARDS[exerciseId][sexKey];
    const ratio = valueKg / bodyweightKg;
    return rankAgainstLevels(ratio, levels, v => v * bodyweightKg);
  }
  if (STRENGTH_STANDARDS_REPS[exerciseId] && reps != null) {
    const levels = STRENGTH_STANDARDS_REPS[exerciseId][sexKey];
    return rankAgainstLevels(reps, levels, v => v);
  }
  return null;
}

function rankAgainstLevels(value, levels, toDisplayValue) {
  let tierIdx = -1;
  for (let i = 0; i < levels.length; i++) {
    if (value >= levels[i]) tierIdx = i;
  }
  const label = tierIdx >= 0 ? STRENGTH_TIER_LABELS[tierIdx] : 'Below beginner';
  const nextIdx = tierIdx + 1;
  const hasNext = nextIdx < levels.length;
  return {
    label,
    nextLabel: hasNext ? STRENGTH_TIER_LABELS[nextIdx] : null,
    nextTargetDisplay: hasNext ? toDisplayValue(levels[nextIdx]) : null,
    isTop: !hasNext,
  };
}
