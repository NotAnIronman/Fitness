const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Date });

function load(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

load('js/data.js');
load('js/calc.js');

// Published Mifflin-St Jeor form, using the example profile discussed during
// the V26 audit: male, 29, 5'10", 204 lb.
const bmr = evaluate(`calcBMR({ sex: 'male', age: 29, heightCm: 177.8, weightKg: 204 / 2.20462262185 })`);
assert.ok(Math.abs(bmr - 1896.58) < 0.1, `unexpected BMR ${bmr}`);

const maintenance = evaluate(`calcMaintenanceEstimate({
  bmr: ${bmr},
  weightKg: ${204 / 2.20462262185},
  stepsPerDay: 6000,
  weeklyExerciseKcal: 1200,
  hasEnoughStepData: false
})`);
assert.ok(maintenance.midpoint > 2500 && maintenance.midpoint < 2600);
assert.ok(maintenance.low < maintenance.midpoint && maintenance.high > maintenance.midpoint);
assert.equal(maintenance.confidence, 'low');

const onePoundWeek = evaluate(`evaluateGoal({
  startWeightKg: ${204 / 2.20462262185},
  targetWeightKg: ${(204 - 1) / 2.20462262185},
  startDate: '2026-09-01',
  targetDate: '2026-09-08',
  tdee: ${maintenance.midpoint}
})`);
assert.ok(Math.abs(onePoundWeek.dailyDeficitNeeded - 500) < 0.01);
assert.ok(Math.abs(onePoundWeek.suggestedIntake - (maintenance.midpoint - 500)) < 0.01);

assert.ok(Math.abs(evaluate('lbToKg(204)') - 92.532) < 0.01);
assert.ok(Math.abs(evaluate('cmToIn(177.8)') - 70) < 0.001);
assert.equal(evaluate('calcBonusStepCalories(3000, 3000)'), 0);
assert.equal(evaluate('checkIntakeSafety(800, \'male\').severe'), true);
assert.equal(evaluate(`getWaterTargetMl(${204 / 2.20462262185})`), 3050);
assert.ok(Math.abs(evaluate(`metCalories(5, ${204 / 2.20462262185}, 60)`) - 485.79) < 0.1);
const navyEstimate = evaluate(`calcNavyBodyFat({ sex: 'male', waistCm: 36 * 2.54, neckCm: 15 * 2.54, heightCm: 70 * 2.54 })`);
assert.ok(navyEstimate > 21 && navyEstimate < 22);

load('js/food.js');
const firstRankedFood = evaluate(`rankFoodResults([
  { name: 'French Fries (Psst)', description: 'French Fries', brandName: 'Psst', dataType: 'Branded', kcal: 179 },
  { name: 'Potato, french fries, restaurant', description: 'Potato, french fries, restaurant', dataType: 'Survey (FNDDS)', kcal: 289 }
], 'French Fries')[0].name`);
assert.equal(firstRankedFood, 'Potato, french fries, restaurant');

console.log('Calculation and food-ranking audit checks passed.');
