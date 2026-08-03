/* ============================================================
   PET-LED GUIDED TOUR
   Action steps are validated from saved app data or an explicit interaction
   marker. Informational steps use a deliberate "Got it" action. Closing the
   guide is always allowed, but only a complete tour earns the achievement.
   ============================================================ */

function onboardingMarkers() {
  if (!STATE.onboarding.markers || typeof STATE.onboarding.markers !== 'object') STATE.onboarding.markers = {};
  return STATE.onboarding.markers;
}

function markOnboarding(marker, value) {
  if (!STATE.onboarding.active) return;
  onboardingMarkers()[marker] = value === undefined ? true : value;
}

function onboardingStepIs(key) {
  return !!STATE.onboarding.active && ONBOARDING_STEPS[STATE.onboarding.step]?.key === key;
}

function hasNamedWorkout() {
  return STATE.workoutPlan.days.some(day => String(day.name || '').trim() && !/^Day(?:\s+\d+)?$/i.test(day.name));
}

const ONBOARDING_STEPS = [
  { key: 'welcome', route: 'home', title: 'Welcome to Forge!', body: `Hey there! I'm Coach. We'll set up every part of Forge together, and I'll check each action as you go. You can minimize or close this guide at any time.`, action: 'Start guided tour', manual: true },
  { key: 'profile', route: 'home', title: 'Tell Forge about you', body: `Fill in your age, height, and weight in Basic Info. These values power your metabolic estimate and personalized ranges; your name stays optional.`, action: 'Open Basic Info', complete: () => STATE.profile.age != null && STATE.profile.heightCm != null && STATE.profile.weightKg != null },
  { key: 'guidance', route: 'home', title: 'Choose your guidance level', body: `Pick how much explanation you want. Even “I know it all!” keeps this tour running, and safety warnings always remain visible.`, action: 'Show guidance', complete: () => !!STATE.uiPrefs.knowledgeLevelTouched },
  { key: 'your_page', route: 'yourpage', title: 'Meet Your Page', body: `Your Page is a personal dashboard. Its tiles read the same tracking data as the full pages, so hiding a tile never stops tracking.`, action: 'Open Your Page', complete: () => !!onboardingMarkers().visitedYourPage },
  { key: 'tile_manager', route: 'yourpage', title: 'Open the Tile manager', body: `Open Tile manager. This is where you add, hide, resize, and reorder dashboard tiles.`, action: 'Show Tile manager', complete: () => !!onboardingMarkers().openedTileManager },
  { key: 'location', route: 'workouts', title: 'Add a training location', body: `Open Training locations and add a place such as Home or Downtown Gym. Separate locations keep unlike equipment histories from being compared.`, action: 'Open Workout Plan', complete: () => getWorkoutLocations().length > 0 },
  { key: 'starting_steps', route: 'workouts', title: 'Set your starting steps', body: `Enter a realistic starting daily step estimate. After five check-ins, Forge relies on your logged rolling average instead.`, action: 'Set starting steps', complete: () => !!onboardingMarkers().startingStepsSet },
  { key: 'workout_day', route: 'workouts', title: 'Add your first workout', body: `Add a training day. Think of it as a reusable workout template, not a record of work already completed.`, action: 'Add a workout', complete: () => STATE.workoutPlan.days.length > 0 },
  { key: 'workout_exercise', route: 'workouts', title: 'Add an exercise', body: `Add at least one exercise to that workout. Start with a plan you can repeat and adjust after real sessions.`, action: 'Add an exercise', complete: () => STATE.workoutPlan.days.some(day => day.exercises.length > 0) },
  { key: 'workout_name', route: 'workouts', title: 'Name the workout', body: `Give the workout a useful name such as Full Body A or Home Upper. Clear names make copying and reviewing much easier.`, action: 'Name the workout', complete: hasNamedWorkout },
  { key: 'log_steps', route: 'log', title: `Log today's steps`, body: `Enter today's step total. This check-in drives your activity estimate, step achievements, and pet travel.`, action: 'Open Workout Log', complete: () => Number(STATE.dailyCheckins[todayISO()]?.steps) >= 0 && !!STATE.dailyCheckins[todayISO()] },
  { key: 'copy_workout', route: 'log', title: 'Copy your planned workout', body: `Use Copy into today to bring over the workout you just made. The log is where planned sets become actual completed work.`, action: 'Copy workout', complete: () => !!onboardingMarkers().copiedPlanToLog },
  { key: 'progress_location', route: 'progress', title: 'Choose the Progress location', body: `Change the location filter to the place you added. Progress comparisons then stay tied to comparable equipment.`, action: 'Open Progress', complete: () => !!onboardingMarkers().progressLocationChanged },
  { key: 'goal_focus', route: 'goals', title: 'Choose the result you want', body: `Select your goal focus. Forge uses it to tune training and nutrition guidance without pretending every person benefits from the same targets.`, action: 'Open Weight Goals', complete: () => !!onboardingMarkers().goalFocusSelected },
  { key: 'weight_goal', route: 'goals', title: 'Set a weight target and date', body: `Enter a target weight and date. Forge will flag timelines that imply an unnecessarily aggressive pace.`, action: 'Set target and date', complete: () => STATE.goal.targetWeightKg != null && !!STATE.goal.targetDate },
  { key: 'weight_log', route: 'goals', title: `Log today's weight`, body: `Use “Log today's weight” so the goal page has a confirmed starting point. Day-to-day fluctuations are normal; use the trend.`, action: 'Log weight', complete: () => !!onboardingMarkers().weightLoggedOnGoals },
  { key: 'food_log', route: 'food', title: 'Log any food item', body: `Search, scan, or add a custom food. Serving data can be incomplete, so review the nutrition label when precision matters.`, action: 'Open Food Tracking', complete: () => (STATE.foodLog[todayISO()] || []).length > 0 },
  { key: 'meal', route: 'food', title: 'Build or group a meal', body: `Save a reusable meal in the builder, or select foods already logged today and combine them. Grouping preserves today's totals.`, action: 'Create a saved meal', complete: () => STATE.savedMeals.length > 0 },
  { key: 'water', route: 'food', title: 'Add water', body: `Log some water for today. The estimate is a starting point, not a requirement that overrides thirst, climate, training, or medical advice.`, action: 'Log water', complete: () => Number(STATE.dailyWater[todayISO()]?.ml) > 0 },
  { key: 'body_fat_info', route: 'bodyfat', title: 'Body-fat estimates', body: `This optional tape-based estimate is useful for broad trends, but measurement technique and the equation can create error. No measurement is required for the tour.`, action: 'Got it', manual: true, autoRoute: true },
  { key: 'achievements_info', route: 'achievements', title: 'Achievements', body: `Achievements reward consistency across steps, training, nutrition, goals, and pet travel. They are motivation tools—not health grades.`, action: 'Got it', manual: true, autoRoute: true },
  { key: 'pet_editor', route: 'pet', title: 'Open Change Pet', body: `Open Change Pet to see the pet name and species controls.`, action: 'Open Pet editor', complete: () => !!onboardingMarkers().openedPetEditor },
  { key: 'pet_species', route: 'pet', title: 'Choose any pet', body: `Choose whichever companion you like—even reselecting the current species counts.`, action: 'Choose a pet', complete: () => !!onboardingMarkers().petSpeciesChosen },
  { key: 'pet_name', route: 'pet', title: 'Rename your pet', body: `Give your companion any name you like.`, action: 'Rename pet', complete: () => !!onboardingMarkers().petRenamed },
  { key: 'pet_editor_close', route: 'pet', title: 'Close Change Pet', body: `Close the Change Pet panel so the Customize shop has room to open cleanly.`, action: 'Close Pet editor', complete: () => !!onboardingMarkers().closedPetEditor },
  { key: 'customize_open', route: 'pet', title: 'Open Customize', body: `Customize contains the shop and the equipment you already own. New purchases equip automatically.`, action: 'Open Customize', complete: () => !!onboardingMarkers().openedCustomize },
  { key: 'buy_cosmetic', route: 'pet', title: 'Buy a cosmetic', body: `Buy a cosmetic. Here's 30 points as a welcome credit to spend in the shop!`, action: 'Buy an item', complete: () => STATE.pet.ownedItems.length > 0 },
  { key: 'customize_close', route: 'pet', title: 'Close Customize', body: `Close Customize to return to the main pet page.`, action: 'Close Customize', complete: () => !!onboardingMarkers().closedCustomizeAfterPurchase },
  { key: 'travel_info', route: 'pet', title: 'How Pet Travel works', body: `Your checked-in steps move the pet toward a selected state, up to 40,000 credited steps per date. Low happiness pauses movement. Silver, Gold, and Platinum arrivals earn souvenirs.`, action: 'Got it', manual: true },
  { key: 'travel_difficulty', route: 'pet', title: 'Choose travel difficulty', body: `Choose Bronze, Silver, Gold, or Platinum. Difficulty changes the user-steps-to-travel-steps ratio and sets the best medal for a clean leg.`, action: 'Choose difficulty', complete: () => !!onboardingMarkers().travelDifficultySelected },
  { key: 'travel_target', route: 'pet', title: 'Choose the first state', body: `Select any state other than your current state to begin a trip. Rerouting later is allowed, with the lower medal warning shown first.`, action: 'Choose destination', complete: () => !!STATE.pet.travel?.targetState },
  { key: 'theme_preset', route: 'themes', title: 'Choose a theme', body: `Pick any preset as your starting point. Forge checks the active colors for readable contrast.`, action: 'Open Themes', complete: () => !!onboardingMarkers().themePresetSelected },
  { key: 'theme_shape', route: 'themes', title: 'Change the shape', body: `Move the corner-radius control to choose sharper or softer cards.`, action: 'Change shape', complete: () => !!onboardingMarkers().themeShapeChanged },
  { key: 'theme_font', route: 'themes', title: 'Change the font', body: `Choose any font pairing. You can change it again at any time.`, action: 'Change font', complete: () => !!onboardingMarkers().themeFontChanged },
  { key: 'transfer_info', route: 'themes', title: 'Your data stays local', body: `Forge has no user account. Transfer tools let you share, copy, scan, export, or import your own data. QR is best for small transfers; file or direct share is better for a long history.`, action: 'Got it', manual: true },
  { key: 'contact_info', route: 'themes', title: 'Contact & support', body: `The Contact & support panel has the ForgeTrainingLog@gmail.com address for bugs, ideas, or help. It opens your mail app without sharing Forge data automatically.`, action: 'Got it', manual: true },
  { key: 'complete', route: 'home', title: `You're ready!`, body: `Thank you for taking the full tour. Forge is now yours to rearrange, simplify, and grow with.`, action: 'Finish tour', manual: true, finish: true },
];

function onboardingStepComplete(index) {
  const step = ONBOARDING_STEPS[index];
  if (!step || !step.complete) return false;
  try { return !!step.complete(); } catch (e) { return false; }
}

function getActiveOnboardingStep() {
  return STATE.onboarding.active ? ONBOARDING_STEPS[STATE.onboarding.step] || null : null;
}

function syncOnboardingStep() {
  if (!STATE.onboarding.active) return;
  let changed = false;
  while (onboardingStepComplete(STATE.onboarding.step)) {
    STATE.onboarding.step += 1;
    changed = true;
  }
  if (changed) persist();
}

function onboardingPrimaryAction() {
  const index = STATE.onboarding.step;
  const step = ONBOARDING_STEPS[index];
  if (!step) return;
  if (step.route && UI.route !== step.route && index !== 0) { navigate(step.route); return; }
  if (step.manual) {
    if (step.finish) {
      STATE.onboarding.active = false;
      STATE.onboarding.dismissed = false;
      STATE.onboarding.completedAt = todayISO();
      persist();
      evaluateAchievements().forEach(a => toast(`Achievement unlocked: ${a.name}`));
      navigate('home');
      toast('Guided tour complete. Welcome to Forge!');
      return;
    }
    STATE.onboarding.step += 1;
    persist();
    if (index === 0) navigate('home'); else render();
    return;
  }
  if (onboardingStepComplete(index)) { STATE.onboarding.step += 1; persist(); render(); return; }
  if (UI.route === step.route) toast('Complete the highlighted action and Coach will continue automatically.');
  else navigate(step.route);
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
  STATE.onboarding = { active: true, dismissed: false, step: 0, skippedSteps: [], completedAt: null, markers: {} };
  STATE.uiPrefs.onboardingGuideCollapsed = false;
  persist(); navigate('home');
}

function renderOnboardingGuide() {
  if (!STATE.onboarding.active || !STATE.pet.enabled) return '';
  syncOnboardingStep();
  const index = Math.min(STATE.onboarding.step, ONBOARDING_STEPS.length - 1);
  const step = ONBOARDING_STEPS[index];
  const actionCount = ONBOARDING_STEPS.length - 2;
  const progress = Math.max(0, Math.min(actionCount, index));
  if (STATE.uiPrefs.onboardingGuideCollapsed) {
    return `<aside class="onboarding-guide onboarding-guide-collapsed" aria-live="polite" aria-label="Forge guided tour, minimized">
      <button class="onboarding-expand" onclick="toggleOnboardingGuideCollapsed()" aria-label="Expand guided tour">Coach · ${escapeAttr(step.title)} <span>+</span></button>
      <button class="onboarding-close" onclick="dismissOnboarding()" aria-label="Close guided tour" title="Close guided tour">×</button>
    </aside>`;
  }
  return `<aside class="onboarding-guide" aria-live="polite" aria-label="Forge guided tour">
    <button class="onboarding-close" onclick="dismissOnboarding()" aria-label="Close guided tour" title="Close guided tour">×</button>
    <button class="onboarding-minimize" onclick="toggleOnboardingGuideCollapsed()" aria-label="Minimize guided tour" title="Minimize guided tour">−</button>
    <div class="onboarding-pet">${renderPetSprite(52)}</div>
    <div class="onboarding-copy">
      <div class="onboarding-kicker">${index === 0 ? 'Your guided tour' : step.finish ? 'Tour complete' : `Tour ${progress} of ${actionCount}`}</div>
      <strong>${escapeAttr(step.title)}</strong>
      <p>${escapeAttr(step.body)}</p>
      <div class="onboarding-actions"><button class="btn btn-primary btn-sm" onclick="onboardingPrimaryAction()">${escapeAttr(step.action)}</button></div>
    </div>
  </aside>`;
}

function toggleOnboardingGuideCollapsed() {
  STATE.uiPrefs.onboardingGuideCollapsed = !STATE.uiPrefs.onboardingGuideCollapsed;
  persist(); render();
}
