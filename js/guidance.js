/* ============================================================
   GOAL-AWARE GUIDANCE

   This module deliberately separates three things that are easy to blur:
   1) the person's chosen outcome, 2) their weight trajectory, and 3) their
   training history. Advice is derived from all three instead of assuming that
   everyone gaining or losing weight has the same needs.

   Values are planning ranges, not medical prescriptions. Evidence links live
   beside the rules so future edits can be audited before the copy changes.
   ============================================================ */

const GOAL_FOCUS_OPTIONS = [
  { key: 'general', label: 'General health', short: 'Build sustainable activity, nutrition, and tracking habits.' },
  { key: 'fat_loss', label: 'Fat loss', short: 'Reduce body fat while protecting health, training quality, and lean mass.' },
  { key: 'weight_gain', label: 'Healthy weight gain', short: 'Gain body weight gradually with adequate food, resistance training, and trend-based adjustments.' },
  { key: 'muscle_gain', label: 'Muscle & strength', short: 'Prioritize progressive resistance training and a conservative energy surplus when appropriate.' },
  { key: 'recomposition', label: 'Recomposition', short: 'Pursue strength and muscle while gradually reducing fat or holding body weight.' },
  { key: 'performance', label: 'Performance', short: 'Support training output, recovery, and sport-specific fueling.' },
];

const TRAINING_EXPERIENCE_OPTIONS = [
  { key: 'new', label: 'New to structured training' },
  { key: 'consistent', label: 'Training consistently' },
  { key: 'advanced', label: 'Highly trained' },
];

const GUIDANCE_EVIDENCE = [
  {
    label: 'Physical Activity Guidelines for Americans',
    url: 'https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines/top-10-things-know',
    note: 'Adults should build toward 150-300 minutes of moderate aerobic activity weekly, or the vigorous equivalent, plus muscle strengthening on at least two days.',
  },
  {
    label: 'National Academies macronutrient reference ranges',
    url: 'https://nap.nationalacademies.org/skim.php?chap=70-81&record_id=11537',
    note: 'The adult acceptable range for fat is 20-35% of energy; carbohydrate and fat allocations should remain flexible within the full diet and training context.',
  },
  {
    label: 'Protein and resistance training meta-analysis',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
    note: 'Benefits for lean-mass gain plateaued around 1.6 g/kg/day on average, with individual uncertainty above that point.',
  },
  {
    label: '2022 protein, muscle mass, and function meta-analysis',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35187864/',
    note: 'Protein needs vary with age and resistance training; ranges are more defensible than one universal target.',
  },
  {
    label: 'Energy surplus study in resistance-trained people',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10620361/',
    note: 'Faster weight gain was more clearly related to additional fat gain than additional hypertrophy, supporting conservative surpluses.',
  },
  {
    label: 'Nutrition and Athletic Performance joint position statement',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26891166/',
    note: 'Energy and macronutrient needs should reflect training demands, recovery, health, and the individual athlete.',
  },
  {
    label: 'Fat-loss phase review for resistance-trained athletes',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8471721/',
    note: 'Moderate loss rates, resistance training, and higher protein can help preserve lean mass during energy restriction.',
  },
];

function getGoalFocusOption(key) {
  return GOAL_FOCUS_OPTIONS.find(option => option.key === key) || GOAL_FOCUS_OPTIONS[0];
}

function getTrainingExperienceOption(key) {
  return TRAINING_EXPERIENCE_OPTIONS.find(option => option.key === key) || TRAINING_EXPERIENCE_OPTIONS[0];
}

function formatGuidanceEvidenceNote(source) {
  const note = String(source?.note || '');
  return usesImperialUnits()
    ? note.replace('1.6 g/kg/day', `${(1.6 / 2.20462262185).toFixed(2)} g/lb/day`)
    : note;
}

function getWeightGoalDirection() {
  const current = currentWeightKg();
  const target = Number(STATE.goal.targetWeightKg);
  if (!current || !Number.isFinite(target) || target <= 0) return 'maintain';
  if (target < current - 0.25) return 'loss';
  if (target > current + 0.25) return 'gain';
  return 'maintain';
}

function getGoalGuidance() {
  const focus = getGoalFocusOption(STATE.goal.focus);
  const experience = getTrainingExperienceOption(STATE.goal.trainingExperience);
  const direction = getWeightGoalDirection();
  const currentKg = currentWeightKg();
  const targetKg = Number(STATE.goal.targetWeightKg) || null;

  let proteinMin = 1.2;
  let proteinMax = 1.6;
  let energy = 'Use estimated maintenance as a starting point, then adjust from several weeks of weight, hunger, recovery, and performance trends.';
  let training = 'Build gradually toward regular aerobic work and at least two weekly strength sessions.';
  let nuance = 'Consistency and an adequate, varied diet matter more than micromanaging a single nutrient.';

  if (focus.key === 'fat_loss') {
    proteinMin = 1.6; proteinMax = 2.2;
    energy = 'Prefer a moderate, sustainable deficit. Faster loss is not automatically better, especially when training performance or recovery declines.';
    training = 'Keep resistance training in the plan to retain strength and lean mass; add activity gradually rather than relying on severe food restriction.';
    nuance = direction === 'gain'
      ? 'Your selected weight target rises while fat loss is the priority. Recheck whether body composition or waist/strength trends are a better target than scale weight alone.'
      : 'People who are already lean or highly trained generally benefit from a slower rate of loss than people with more fat to lose.';
  } else if (focus.key === 'weight_gain') {
    proteinMin = 1.4; proteinMax = 2.0;
    energy = direction === 'loss'
      ? 'Your scale target is lower than your current weight, which conflicts with healthy weight gain. Raise the target or choose a different focus before using a surplus.'
      : 'Start with a modest surplus—often about 5-10% above estimated maintenance—and adjust only after at least two to four weeks of comparable weigh-ins.';
    training = 'Use progressive resistance training so more of the gained weight supports muscle and performance; food alone cannot direct all gain toward lean tissue.';
    nuance = 'Energy-dense foods, regular meals or snacks, and liquid calories can help when appetite is limiting. Faster gain is more likely to include unnecessary fat, and unexplained low weight or poor appetite deserves clinical support.';
  } else if (focus.key === 'muscle_gain') {
    proteinMin = 1.6; proteinMax = 2.2;
    const surplus = experience.key === 'new' ? 'about 5-15%' : experience.key === 'consistent' ? 'about 5-10%' : 'the smallest surplus that produces a reliable upward trend';
    energy = direction === 'loss'
      ? 'Because your scale target is lower, use a modest deficit or maintenance phase rather than a bulk. Muscle gain can still occur, especially for newer trainees or people returning to training.'
      : `If body weight and gym performance are not rising over several weeks, consider a conservative surplus (${surplus} above estimated maintenance), then adjust from the trend.`;
    training = 'Progressive resistance training is the primary muscle-building signal; calories and protein support it but cannot replace it.';
    nuance = experience.key === 'advanced'
      ? 'Highly trained lifters usually gain muscle more slowly, so aggressive scale-weight gain is especially likely to add unnecessary fat.'
      : 'Newer lifters can often progress without a large surplus; start conservatively and review strength and weight trends.';
  } else if (focus.key === 'recomposition') {
    proteinMin = 1.6; proteinMax = 2.2;
    energy = direction === 'loss'
      ? 'A small deficit can support gradual fat loss while resistance training and protein help preserve or build lean mass.'
      : 'Maintenance calories are a reasonable starting point; use waist, photos, measurements, and strength—not scale weight alone—to judge progress.';
    training = 'Prioritize progressive resistance training and adequate recovery. Recomposition is usually slower than a dedicated gaining or loss phase.';
    nuance = 'This approach is often most productive for newer trainees, people returning after time off, and people with more stored energy available.';
  } else if (focus.key === 'performance') {
    proteinMin = 1.4; proteinMax = 2.0;
    energy = 'Avoid chronic under-fueling. Match total energy and carbohydrate availability to the duration, intensity, and frequency of training.';
    training = 'Sport demands should drive the plan. Longer or high-intensity sessions generally require more deliberate carbohydrate and recovery planning.';
    nuance = 'Performance nutrition varies substantially by sport; Forge intentionally avoids inventing one carbohydrate target without training-duration context.';
  }

  // For a loss-oriented trajectory, target weight is a more useful and less
  // inflated protein reference than current weight for many larger users.
  const proteinReferenceKg = currentKg
    ? (direction === 'loss' && targetKg ? Math.max(currentKg * 0.65, Math.min(currentKg, targetKg)) : currentKg)
    : null;

  return {
    focus,
    experience,
    direction,
    proteinMin,
    proteinMax,
    proteinReferenceKg,
    proteinLowGrams: proteinReferenceKg ? Math.round(proteinReferenceKg * proteinMin) : null,
    proteinHighGrams: proteinReferenceKg ? Math.round(proteinReferenceKg * proteinMax) : null,
    energy,
    training,
    nuance,
  };
}

// This is a transparent starting allocation, not a rigid prescription.
// Protein is goal/body-weight based; fat stays inside the adult AMDR; carbs
// receive the remaining energy because their useful amount changes most with
// training volume and sport demands.
function getGoalMacroPlan(calorieTarget) {
  const guidance = getGoalGuidance();
  const kcal = Number(calorieTarget);
  if (!Number.isFinite(kcal) || kcal <= 0 || !guidance.proteinLowGrams) return null;
  const fatMinPct = 0.20;
  const fatMaxPct = guidance.focus.key === 'performance' ? 0.30 : 0.35;
  const fatMidPct = (fatMinPct + fatMaxPct) / 2;
  const proteinMid = (guidance.proteinLowGrams + guidance.proteinHighGrams) / 2;
  const carbEstimateGrams = Math.max(0, Math.round((kcal - proteinMid * 4 - kcal * fatMidPct) / 4));
  return {
    ...guidance,
    calorieTarget: kcal,
    fatLowGrams: Math.round(kcal * fatMinPct / 9),
    fatHighGrams: Math.round(kcal * fatMaxPct / 9),
    fatMinPct: Math.round(fatMinPct * 100),
    fatMaxPct: Math.round(fatMaxPct * 100),
    carbEstimateGrams,
    carbNote: guidance.focus.key === 'performance'
      ? 'Carbohydrate is the main adjustable fuel for training. Increase it around longer or harder sessions and judge the result from performance and recovery.'
      : 'Carbohydrate receives the flexible calories left after protein and fat. Move it up or down with activity, preference, hunger, and training performance.',
  };
}

function setGoalFocus(key) {
  STATE.goal.focus = getGoalFocusOption(key).key;
  markOnboarding('goalFocusSelected');
  persist(); render();
}

function setTrainingExperience(key) {
  STATE.goal.trainingExperience = getTrainingExperienceOption(key).key;
  persist(); render();
}
