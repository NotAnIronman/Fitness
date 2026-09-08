const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Date });

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
}

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

vm.runInContext(`
  var UI = { habitDate: '2026-09-07' };
  var STATE = { habits: { items: [], log: {} } };
  function todayISO() { return '2026-09-07'; }
  function dateToLocalISO(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function persist() {}
  function render() {}
  function toast() {}
  function escapeAttr(value) { return String(value == null ? '' : value); }
  function uid() { return 'generated'; }
`, context);

load('js/storage.js');
load('js/habits.js');

evaluate(`STATE.habits = {
  items: [{ id: 'daily', name: 'Daily', icon: '✓', cue: '', difficulty: 'easy', target: 1, days: [0,1,2,3,4,5,6], createdDate: '2026-09-01', archivedAt: null }],
  log: {
    '2026-09-01': { daily: 1 }, '2026-09-02': { daily: 1 }, '2026-09-03': { daily: 1 },
    '2026-09-04': { daily: 1 }, '2026-09-05': { daily: 1 }, '2026-09-06': { daily: 1 }
  }
}`);
assert.equal(evaluate('habitCurrentStreak(STATE.habits.items[0])'), 6, 'unfinished today should not erase the prior streak');

evaluate(`delete STATE.habits.log['2026-09-04']`);
assert.equal(evaluate('habitCurrentStreak(STATE.habits.items[0])'), 2, 'a missed scheduled day should end the earlier run');

evaluate(`STATE.habits = {
  items: [{ id: 'weekdays', name: 'Weekdays', icon: '✓', cue: '', difficulty: 'easy', target: 1, days: [1,2,3,4,5], createdDate: '2026-09-01', archivedAt: null }],
  log: { '2026-09-04': { weekdays: 1 }, '2026-09-07': { weekdays: 1 } }
}`);
assert.equal(evaluate('habitCurrentStreak(STATE.habits.items[0])'), 2, 'unscheduled weekend days should not break a weekday streak');

evaluate(`STATE.habits.items[0].target = 3; STATE.habits.log['2026-09-07'].weekdays = 2`);
assert.equal(evaluate(`habitIsDone(STATE.habits.items[0], '2026-09-07')`), false);
evaluate(`STATE.habits.log['2026-09-07'].weekdays = 3`);
assert.equal(evaluate(`habitIsDone(STATE.habits.items[0], '2026-09-07')`), true);

const normalized = evaluate(`normalizeHabits({
  items: [{ id: 'safe', name: '<b>Walk</b>', target: 99, days: [1,1,9], createdDate: 'bad' }],
  log: { '2026-09-07': { safe: 88, missing: 1 }, nope: { safe: 1 } }
})`);
assert.equal(normalized.items[0].target, 20);
assert.deepEqual([...normalized.items[0].days], [1]);
assert.equal(normalized.log['2026-09-07'].safe, 20);
assert.equal(normalized.log.nope, undefined);

console.log('Habit scheduling, streak, target, and state-normalization checks passed.');
