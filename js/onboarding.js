/* ============================================================
   PET-LED FIRST-RUN SETUP
   Each step is validated from real app data, not button clicks. A fresh
   install starts here; upgraded saves are opted out in loadState().
   ============================================================ */

const ONBOARDING_STEPS = [
  {
    route: 'home', title: 'Welcome to Forge!',
    body: `Hey there! I'm Coach, and I can help you get everything working. I'll only move on when a step is actually set up. Already comfortable? Close me any time.`,
    action: 'Start setup', manual: true,
  },
  {
    route: 'home', title: 'Build your estimate',
    body: `Start with age, height, and weight in Basic Info. Those three values let Forge calculate your resting and total daily energy estimates. Your name is optional.`,
    action: 'Go to Basic Info',
  },
  {
    route: 'home', title: 'Choose your guidance level',
    body: `Tell me how familiar you are with health and fitness. This only changes how much optional explanation you see—it never hides safety warnings.`,
    action: 'Show the guidance slider',
  },
  {
    route: 'workouts', title: 'Create a workout plan',
    body: `Add at least one exercise to a training day. Keep the first version realistic; a plan you can repeat is more useful than a perfect plan you cannot.`,
    action: 'Open Workout Plan',
  },
  {
    route: 'log', title: 'Log your first steps',
    body: `Open Workout Log and enter today's steps. Forge uses your check-ins to replace the starting estimate with your real rolling average.`,
    action: 'Open Workout Log',
  },
  {
    route: 'goals', title: 'Set a weight goal—if you want one',
    body: `A target weight and date unlock pace and calorie-planning feedback. Weight change is optional, so you can skip this without losing any other feature.`,
    action: 'Open Weight Goals', optional: true,
  },
  {
    route: 'food', title: 'Try the food log',
    body: `Log one food or drink so you know the workflow. Your target is a planning estimate, not a pass/fail score; trends across days matter more than one day.`,
    action: 'Open Food Tracking',
  },
  {
    route: 'home', title: "You're ready!",
    body: `Your core setup is active. Keep checking in, adjust the plan when life changes, and use Progress for trends instead of judging a single day. You can restart this guide from Themes.`,
    action: 'Finish', manual: true,
  },
];

function onboardingStepComplete(index) {
  if (index === 1) return STATE.profile.age != null && STATE.profile.heightCm != null && STATE.profile.weightKg != null;
  if (index === 2) return !!STATE.uiPrefs.knowledgeLevelTouched;
  if (index === 3) return STATE.workoutPlan.days.some(day => Array.isArray(day.exercises) && day.exercises.length > 0);
  if (index === 4) return Object.values(STATE.dailyCheckins).some(entry => Number(entry.steps) > 0);
  if (index === 5) return (STATE.goal.targetWeightKg != null && !!STATE.goal.targetDate) || STATE.onboarding.skippedSteps.includes(5);
  if (index === 6) return Object.values(STATE.foodLog).some(entries => Array.isArray(entries) && entries.length > 0);
  return false;
}

function syncOnboardingStep() {
  if (!STATE.onboarding.active) return;
  let changed = false;
  while (STATE.onboarding.step >= 1 && STATE.onboarding.step <= 6 && onboardingStepComplete(STATE.onboarding.step)) {
    STATE.onboarding.step += 1;
    changed = true;
  }
  if (changed) persist();
}

function onboardingPrimaryAction() {
  const index = STATE.onboarding.step;
  const step = ONBOARDING_STEPS[index];
  if (index === 0) {
    STATE.onboarding.step = 1;
    persist(); navigate('home');
    return;
  }
  if (index === 7) {
    STATE.onboarding.active = false;
    STATE.onboarding.completedAt = todayISO();
    persist(); render();
    toast('Setup complete. Welcome to Forge!');
    return;
  }
  if (onboardingStepComplete(index)) {
    STATE.onboarding.step += 1;
    persist(); render();
    return;
  }
  if (UI.route === step.route) toast('Finish the highlighted step, and I will check it automatically.');
  else navigate(step.route);
}

function skipOnboardingStep(index) {
  if (index !== 5 || STATE.onboarding.step !== 5) return;
  if (!STATE.onboarding.skippedSteps.includes(index)) STATE.onboarding.skippedSteps.push(index);
  STATE.onboarding.step = 6;
  persist(); render();
}

function dismissOnboarding() {
  STATE.onboarding.active = false;
  STATE.onboarding.dismissed = true;
  persist(); render();
}

function restartOnboarding() {
  STATE.pet.enabled = true;
  if (!STATE.pet.species) STATE.pet.species = 'dog';
  if (!STATE.pet.name) STATE.pet.name = 'Coach';
  STATE.onboarding.active = true;
  STATE.onboarding.dismissed = false;
  STATE.onboarding.step = 0;
  STATE.onboarding.skippedSteps = [];
  STATE.onboarding.completedAt = null;
  persist(); navigate('home');
}

function renderOnboardingGuide() {
  if (!STATE.onboarding.active || !STATE.pet.enabled) return '';
  syncOnboardingStep();
  const index = STATE.onboarding.step;
  const step = ONBOARDING_STEPS[index] || ONBOARDING_STEPS[0];
  const setupSteps = 6;
  const progress = index === 0 ? 0 : Math.min(setupSteps, index - 1);
  return `<aside class="onboarding-guide" aria-live="polite" aria-label="Forge setup guide">
    <button class="onboarding-close" onclick="dismissOnboarding()" aria-label="Close setup guide" title="Close setup guide">×</button>
    <div class="onboarding-pet">${renderPetSprite(52)}</div>
    <div class="onboarding-copy">
      <div class="onboarding-kicker">${index === 0 ? 'Your setup guide' : index === 7 ? 'Setup complete' : `Setup ${progress + 1} of ${setupSteps}`}</div>
      <strong>${step.title}</strong>
      <p>${step.body}</p>
      <div class="onboarding-actions">
        <button class="btn btn-primary btn-sm" onclick="onboardingPrimaryAction()">${step.action}</button>
        ${step.optional ? `<button class="btn btn-ghost btn-sm" onclick="skipOnboardingStep(${index})">Skip for now</button>` : ''}
      </div>
    </div>
  </aside>`;
}
