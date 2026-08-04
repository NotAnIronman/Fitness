/* ============================================================
   CALCULATIONS
   ============================================================ */

// --- Unit conversions ---
const kgToLb = kg => kg * 2.20462262185;
const lbToKg = lb => lb / 2.20462262185;
const cmToIn = cm => cm / 2.54;
const inToCm = inch => inch * 2.54;

// User-facing measurement helpers. Internal calculations stay metric so there
// is one source of truth; every rendered value goes through these helpers.
function usesImperialUnits() { return STATE.profile.unitSystem === 'imperial'; }
function displayWeightUnit() { return usesImperialUnits() ? 'lb' : 'kg'; }
function displayWeightValue(weightKg, decimals = 1) {
  if (!Number.isFinite(Number(weightKg))) return null;
  const value = usesImperialUnits() ? kgToLb(Number(weightKg)) : Number(weightKg);
  return Number(value.toFixed(decimals));
}
function formatWeightKg(weightKg, decimals = 1) {
  const value = displayWeightValue(weightKg, decimals);
  return value == null ? '—' : `${value.toLocaleString()} ${displayWeightUnit()}`;
}
function formatProteinRateRange(minPerKg, maxPerKg) {
  if (usesImperialUnits()) {
    return `${(minPerKg / 2.20462262185).toFixed(2)}-${(maxPerKg / 2.20462262185).toFixed(2)} g/lb`;
  }
  return `${Number(minPerKg).toFixed(1)}-${Number(maxPerKg).toFixed(1)} g/kg`;
}
function formatHydrationRate(mlPerKg = 33) {
  return usesImperialUnits()
    ? `${(mlPerKg / 29.5735 / 2.20462262185).toFixed(2)} fl oz/lb`
    : `${Math.round(mlPerKg)} mL/kg`;
}
function formatFoodNameForUnits(name) {
  if (!usesImperialUnits()) return String(name || '');
  return String(name || '').replace(/\((\d+(?:\.\d+)?)\s*g\)/gi, (_, grams) => {
    const ounces = Number(grams) / 28.349523125;
    return `(${ounces.toFixed(ounces >= 1 ? 1 : 2)} oz)`;
  });
}

// --- BMR: Mifflin-St Jeor equation ---
function calcBMR({ sex, age, heightCm, weightKg }) {
  if (!age || age < 18 || age > 100 || !heightCm || !weightKg) return null;
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

// Workout entries are plain persisted data, but several flows copy entries.
// Keep nested per-set objects independent so completion/editing in one log can
// never mutate a plan template, a recent-item snapshot, or another date.
function cloneExerciseEntry(entry, overrides) {
  const cloned = {
    ...entry,
    custom: entry.custom ? { ...entry.custom } : entry.custom,
    perSetWeights: entry.perSetWeights ? entry.perSetWeights.map(s => ({ ...s })) : entry.perSetWeights,
  };
  return Object.assign(cloned, overrides || {});
}

function expandExerciseEntryForLog(entry, resetCompletion) {
  const out = cloneExerciseEntry(entry);
  if (!out.perSetWeights && Number(out.sets) >= 2 && Number(out.reps) > 0) {
    out.perSetWeights = Array.from({ length: Math.min(100, Math.round(Number(out.sets))) }, () => ({
      reps: Number(out.reps) || 0,
      weightKg: Number(out.weightKg) || 0,
      weightIsPerSide: !!out.weightIsPerSide,
      completed: resetCompletion ? false : !!out.completed,
    }));
    out.sets = out.perSetWeights.length;
  }
  if (resetCompletion && out.perSetWeights) out.perSetWeights.forEach(set => { set.completed = false; });
  if (resetCompletion) out.completed = false;
  return out;
}

function hasCompletedWork(entry) {
  if (!entry) return false;
  if (entry.perSetWeights && entry.perSetWeights.length) {
    return entry.perSetWeights.some(s => !!s.completed);
  }
  return !!entry.completed;
}

function completedExerciseEntry(entry) {
  if (!hasCompletedWork(entry)) return null;
  if (entry.perSetWeights && entry.perSetWeights.length) {
    const completedSets = entry.perSetWeights.filter(s => s.completed).map(s => ({ ...s }));
    return cloneExerciseEntry(entry, { perSetWeights: completedSets, sets: completedSets.length, completed: true });
  }
  return cloneExerciseEntry(entry);
}

function isExerciseFullyCompleted(entry) {
  if (!entry) return false;
  if (entry.perSetWeights && entry.perSetWeights.length) return entry.perSetWeights.every(s => !!s.completed);
  return !!entry.completed;
}

// Estimate elapsed strength-training time: rep work plus the rests between sets.
// Rest is not treated as lifting, but it is part of session energy expenditure.
function estimateStrengthMinutes(sets, reps) {
  if (!sets || !reps) return 0;
  const workSeconds = sets * reps * 3.5;
  const restSeconds = Math.max(0, sets - 1) * (Number(STATE?.workoutPlan?.restTimerSeconds) || 90);
  return (workSeconds + restSeconds) / 60;
}

// Same idea, but reading per-set rep counts when the entry uses different
// weights/reps per set instead of one aggregate sets x reps figure.
function estimateStrengthMinutesFromEntry(entry) {
  if (entry.perSetWeights && entry.perSetWeights.length) {
    let totalSeconds = 0;
    entry.perSetWeights.forEach(set => { totalSeconds += (Number(set.reps) || 0) * 3.5; });
    totalSeconds += Math.max(0, entry.perSetWeights.length - 1) * (Number(STATE?.workoutPlan?.restTimerSeconds) || 90);
    return totalSeconds / 60;
  }
  return estimateStrengthMinutes(Number(entry.sets), Number(entry.reps));
}

// Compute calories for a single logged exercise entry.
// entry: { exerciseId, sets, reps, weightKg, weightIsPerSide, perSetWeights, durationMin }
function strengthTimingFromEntry(entry) {
  const sets = entry.perSetWeights?.length || Math.max(0, Math.round(Number(entry.sets) || 0));
  const reps = entry.perSetWeights
    ? entry.perSetWeights.reduce((sum, set) => sum + (Number(set.reps) || 0), 0)
    : sets * (Number(entry.reps) || 0);
  return {
    workMinutes: reps * 3.5 / 60,
    restMinutes: Math.max(0, sets - 1) * (Number(STATE?.workoutPlan?.restTimerSeconds) || 90) / 60,
  };
}

function calcExerciseEnergyBreakdown(entry, bodyWeightKg) {
  const ex = EXERCISE_LIBRARY.find(e => e.id === entry.exerciseId) || entry.custom;
  if (!ex || !bodyWeightKg) return { duringKcal: 0, netKcal: 0, workMinutes: 0, restMinutes: 0, isStrength: false };
  let minutes = 0;
  let workMinutes = 0;
  let restMinutes = 0;
  let duringKcal = 0;
  if (ex.inputMode === 'duration') {
    minutes = Number(entry.durationMin) || 0;
    workMinutes = minutes;
    duringKcal = metCalories(ex.met, bodyWeightKg, minutes);
  } else if (ex.inputMode === 'setsRepsWeight' || ex.inputMode === 'setsReps') {
    const timing = strengthTimingFromEntry(entry);
    workMinutes = timing.workMinutes;
    restMinutes = timing.restMinutes;
    let workIntensity = ex.met;
    // Small intensity bump if lifting heavy relative to bodyweight. Load is
    // not converted directly to calories because external load and metabolic
    // cost do not have a simple linear relationship.
    if (ex.inputMode === 'setsRepsWeight') {
      const totalLoad = effectiveLoadKg(entry);
      const ratio = totalLoad / bodyWeightKg;
      if (ratio > 1) workIntensity *= 1.15;
    }
    duringKcal = metCalories(workIntensity, bodyWeightKg, workMinutes)
      + metCalories(1.8, bodyWeightKg, restMinutes);
  } else if (ex.inputMode === 'distance') {
    minutes = Number(entry.durationMin) || 0;
    workMinutes = minutes;
    duringKcal = metCalories(ex.met, bodyWeightKg, minutes);
  }
  const elapsedMinutes = workMinutes + restMinutes;
  const restingKcal = metCalories(1, bodyWeightKg, elapsedMinutes);
  return {
    duringKcal,
    netKcal: Math.max(0, duringKcal - restingKcal),
    workMinutes,
    restMinutes,
    isStrength: ex.category === 'Strength',
  };
}

function calcExerciseCalories(entry, bodyWeightKg) {
  return calcExerciseEnergyBreakdown(entry, bodyWeightKg).duringKcal;
}

// EPOC varies widely with session intensity, density, volume, and the person.
// Show it once at session level as a conservative range, never as a precise
// per-exercise bonus. The 5-15% range is a planning approximation and is capped
// so it cannot turn "afterburn" into a misleading weight-loss promise.
function calcWorkoutEnergy(entries, bodyWeightKg) {
  const parts = (entries || []).map(entry => calcExerciseEnergyBreakdown(entry, bodyWeightKg));
  const duringKcal = parts.reduce((sum, part) => sum + part.duringKcal, 0);
  const strengthNetKcal = parts.filter(part => part.isStrength).reduce((sum, part) => sum + part.netKcal, 0);
  const epocLow = Math.min(60, strengthNetKcal * 0.05);
  const epocHigh = Math.min(60, strengthNetKcal * 0.15);
  return {
    duringKcal,
    epocLow,
    epocHigh,
    totalLow: duringKcal + epocLow,
    totalHigh: duringKcal + epocHigh,
  };
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
  const ratePctBodyWeightPerWeek = startWeightKg > 0 ? (Math.abs(deltaKg) / startWeightKg / weeks) * 100 : null;
  const dailyDeficitNeeded = (Math.abs(deltaLb) * 3500) / days; // kcal/day required
  const suggestedIntakeRaw = tdee ? tdee - (deltaLb < 0 ? dailyDeficitNeeded : -dailyDeficitNeeded) : null;

  // Feasibility bands based on widely-cited safe rate of change (~0.5-1% bodyweight/week, capped ~2lb/week loss, ~0.5-1lb/week gain)
  const absRate = Math.abs(ratePerWeekLb);
  const pctRate = ratePctBodyWeightPerWeek || 0;
  let feasibility = 'reasonable';
  if (deltaLb < 0) {
    if (pctRate > 1.25 || absRate > 2.5) feasibility = 'unlikely';
    else if (pctRate > 1.0 || absRate > 2.0) feasibility = 'ambitious';
  } else if (deltaLb > 0) {
    if (pctRate > 1.0 || absRate > 1.5) feasibility = 'unlikely';
    else if (pctRate > 0.5 || absRate > 0.75) feasibility = 'ambitious';
  }

  // A timeline may be mathematically computable without being an appropriate
  // calorie prescription. Do not operationalize targets below a conservative
  // adult floor, deficits above 1,000 kcal/day, or a timeline already labeled
  // unlikely. The UI asks the person to extend the date instead.
  const unsafeTarget = deltaLb < 0 && !!tdee && (
    suggestedIntakeRaw < 1200 || dailyDeficitNeeded > 1000 || feasibility === 'unlikely'
  );
  const suggestedIntake = unsafeTarget ? null : suggestedIntakeRaw;

  return {
    deltaLb, ratePerWeekLb, ratePctBodyWeightPerWeek, dailyDeficitNeeded,
    suggestedIntake, suggestedIntakeRaw, unsafeTarget, feasibility, weeks, days,
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
  // Do not turn impossible measurements into a plausible-looking boundary
  // value. Extremely low/high outputs are more likely measurement errors.
  return Number.isFinite(bf) && bf >= 2 && bf <= 70 ? bf : null;
}

function getNavyMeasurementError({ sex, waistCm, neckCm, hipCm, heightCm }) {
  if (!waistCm || !neckCm || !heightCm || (sex === 'female' && !hipCm)) return null;
  if ([waistCm, neckCm, heightCm, hipCm].filter(v => v != null).some(v => v <= 0)) return 'Measurements must be greater than zero.';
  if (sex === 'male' && waistCm <= neckCm) return 'Waist must be larger than neck for this equation. Recheck the tape positions.';
  if (sex === 'female' && waistCm + hipCm <= neckCm) return 'These measurements cannot be evaluated. Recheck the tape positions and units.';
  const value = calcNavyBodyFat({ sex, waistCm, neckCm, hipCm, heightCm });
  if (value == null) return 'The result is outside this method\'s plausible range. Recheck the measurements and units.';
  return null;
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
// --- Daily water target ---
// A 33 mL/kg estimate gives users a practical fluid-logging starting point. It
// is deliberately not presented as an official requirement: National Academies
// Adequate Intakes are absolute total-water values (food plus all beverages),
// not weight-based drinking-water prescriptions. Needs vary with environment,
// illness, pregnancy/lactation, and exercise/sweat losses.
function getWaterTargetMl(weightKg) {
  if (!weightKg) return null;
  const mlPerKg = 33;
  let target = weightKg * mlPerKg;
  return Math.round(target / 50) * 50; // round to a clean number
}

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

// Explains, in plain language with the actual numbers plugged in, how a specific
// logged exercise's calorie estimate was reached. Shown as a tap/hover tooltip so
// it doesn't clutter the row itself.
function explainExerciseCalc(entry, ex, bodyWeightKg) {
  if (!ex || !bodyWeightKg) return 'Add your weight on Home to see this breakdown.';
  const bwRound = Math.round(bodyWeightKg);
  const bwLb = Math.round(kgToLb(bodyWeightKg));
  const bodyWeightText = formatWeightKg(bodyWeightKg, 0);
  const formulaWeightText = usesImperialUnits() ? `${bwLb} lb ÷ 2.2046` : `${bwRound} kg`;
  if (ex.inputMode === 'duration' || ex.inputMode === 'distance') {
    const rawMin = Number(entry.durationMin) || 0;
    const minutes = rawMin;
    const kcal = metCalories(ex.met, bodyWeightKg, minutes);
    const perMinute = rawMin > 0 ? kcal / rawMin : 0;
    let text = `<strong>${perMinute.toFixed(2)} kcal/min × ${rawMin} min = ${Math.round(kcal)} kcal</strong><br>Uses ${bodyWeightText} bodyweight and MET ${ex.met}: ${ex.met} × 3.5 × (${formulaWeightText}) ÷ 200 × ${minutes.toFixed(1)} active min.`;
    if (ex.category === 'Strength') text += ` This is a whole-session MET value, so normal between-set rest is already represented.`;
    return text;
  }
  const timing = strengthTimingFromEntry(entry);
  let workMet = ex.met;
  const loadRatio = ex.inputMode === 'setsRepsWeight' ? effectiveLoadKg(entry) / bodyWeightKg : 0;
  const heavyAdjustment = loadRatio > 1 ? 1.15 : 1;
  workMet *= heavyAdjustment;
  const workKcal = metCalories(workMet, bodyWeightKg, timing.workMinutes);
  const restKcal = metCalories(1.8, bodyWeightKg, timing.restMinutes);
  const kcal = workKcal + restKcal;
  const totalReps = entry.perSetWeights
    ? entry.perSetWeights.reduce((s, st) => s + (Number(st.reps) || 0), 0)
    : (Number(entry.sets) || 0) * (Number(entry.reps) || 0);
  const perRep = totalReps > 0 ? kcal / totalReps : 0;
  const load = effectiveLoadKg(entry);
  const loadText = load > 0 ? `; top load ${formatWeightKg(load, 0)}` : '';
  return `<strong>${Math.round(workKcal)} lifting kcal + ${Math.round(restKcal)} between-set kcal = ${Math.round(kcal)} kcal during the exercise</strong><br>Uses ${bodyWeightText} bodyweight${loadText}, MET ${ex.met}, about 3.5 seconds per rep, and MET 1.8 for ${timing.restMinutes.toFixed(1)} estimated rest min${heavyAdjustment > 1 ? ' (small load-above-bodyweight adjustment included)' : ''}. Post-exercise energy is uncertain and is added once in the session total, not to every exercise.`;
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
