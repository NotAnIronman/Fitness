const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({ console, Math, Date });

vm.runInContext(`
  function escapeAttr(value) { return String(value == null ? '' : value); }
  function tip(label, title, body) { return '<button>' + label + title + body + '</button>'; }
`, context);
vm.runInContext(read('js/guidance.js'), context, { filename: 'js/guidance.js' });
vm.runInContext(read('js/data.js'), context, { filename: 'js/data.js' });

const sourceCount = vm.runInContext('Object.keys(SCIENCE_SOURCES).length', context);
assert.ok(sourceCount >= 15, `expected broad source registry, found ${sourceCount}`);
const invalidSources = vm.runInContext(`Object.entries(SCIENCE_SOURCES).filter(([, source]) => !source.label || !source.note || !source.url.startsWith('https://'))`, context);
assert.equal(invalidSources.length, 0, 'every science source needs a label, note, and HTTPS URL');

const exerciseCount = vm.runInContext('EXERCISE_LIBRARY.length', context);
assert.ok(exerciseCount >= 175, `expanded exercise library should have at least 175 entries, found ${exerciseCount}`);
const duplicateIds = vm.runInContext(`EXERCISE_LIBRARY.map(item => item.id).filter((id, index, all) => all.indexOf(id) !== index)`, context);
assert.equal(duplicateIds.length, 0, 'exercise ids must be unique');

const combinedUi = ['js/app.js','js/log.js','js/food.js','js/goals.js','js/bodyfat.js','js/workouts.js','js/habits.js'].map(read).join('\n');
for (const required of ['calculationTip(', "['mifflin'", "['sessionRpe'", "['protein'", "['water'", "['navyBodyFat'"]) {
  assert.ok(combinedUi.includes(required), `missing calculation evidence hook: ${required}`);
}
assert.ok(read('js/habits.js').includes('openMojiIcon('), 'habit pictographs must render through OpenMoji');
assert.ok(read('js/app.js').includes('APP_ICON_PATHS'), 'interface glyphs must use the open-source SVG icon system');

console.log('Science registry, calculation disclosure, exercise expansion, and icon-policy checks passed.');
