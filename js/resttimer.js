/* ============================================================
   REST TIMER
   A simple countdown for resting between sets or between exercises.
   State here is intentionally NOT persisted to STATE/localStorage,
   it's a live, ephemeral countdown, module-level so it survives the
   app's normal full-page re-renders without needing a full render()
   on every second (that would fight with focus-preservation and be
   wasteful), only the timer's own display element gets touched each
   tick, everything else re-renders normally as usual.
   ============================================================ */

let _restTimer = {
  running: false,
  secondsLeft: 0,
  totalSeconds: 0,
  label: '',
  tickHandle: null,
};

function startRestTimer(seconds, label) {
  stopRestTimerInterval();
  _restTimer = {
    running: true,
    secondsLeft: seconds,
    totalSeconds: seconds,
    label: label || 'Rest',
    tickHandle: null,
  };
  _restTimer.tickHandle = setInterval(restTimerTick, 1000);
  render(); // one full render to mount the widget, then ticks update it directly
}

function restTimerTick() {
  if (!_restTimer.running) return;
  _restTimer.secondsLeft -= 1;
  if (_restTimer.secondsLeft <= 0) {
    _restTimer.secondsLeft = 0;
    _restTimer.running = false;
    stopRestTimerInterval();
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) { /* not supported */ } }
    toast(`${_restTimer.label} done!`);
    render();
    return;
  }
  updateRestTimerDisplay();
}

function pauseRestTimer() {
  _restTimer.running = !_restTimer.running;
  if (_restTimer.running) {
    _restTimer.tickHandle = setInterval(restTimerTick, 1000);
  } else {
    stopRestTimerInterval();
  }
  render();
}

function stopRestTimer() {
  stopRestTimerInterval();
  _restTimer = { running: false, secondsLeft: 0, totalSeconds: 0, label: '', tickHandle: null };
  render();
}

function addRestTimerSeconds(delta) {
  _restTimer.secondsLeft = Math.max(0, _restTimer.secondsLeft + delta);
  _restTimer.totalSeconds = Math.max(_restTimer.totalSeconds, _restTimer.secondsLeft);
  updateRestTimerDisplay();
}

function stopRestTimerInterval() {
  if (_restTimer.tickHandle) { clearInterval(_restTimer.tickHandle); _restTimer.tickHandle = null; }
}

// Updates just the countdown text/ring in place, no full render() per tick, so
// it never disrupts whatever else is on screen (a focused input, an open form).
function updateRestTimerDisplay() {
  const el = document.getElementById('rest-timer-seconds');
  if (el) el.textContent = formatRestTime(_restTimer.secondsLeft);
  const bar = document.getElementById('rest-timer-bar');
  if (bar && _restTimer.totalSeconds > 0) {
    bar.style.width = `${(_restTimer.secondsLeft / _restTimer.totalSeconds) * 100}%`;
  }
}

function formatRestTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Floating widget, mounted the same way the pet widget is, visible from any
// page while a timer is active so "between exercises" can span leaving the
// Log page (checking Progress, etc.) without losing the countdown.
function renderRestTimerWidget() {
  if (!_restTimer.totalSeconds) return '';
  return `
    <div class="rest-timer-widget">
      <div class="rest-timer-label">${escapeAttr(_restTimer.label)}</div>
      <div class="rest-timer-time" id="rest-timer-seconds">${formatRestTime(_restTimer.secondsLeft)}</div>
      <div class="rest-timer-track"><div class="rest-timer-fill" id="rest-timer-bar" style="width:${_restTimer.totalSeconds ? (_restTimer.secondsLeft / _restTimer.totalSeconds) * 100 : 0}%;"></div></div>
      <div class="rest-timer-controls">
        <button class="btn btn-sm" onclick="addRestTimerSeconds(-15)">-15s</button>
        <button class="btn btn-sm" onclick="pauseRestTimer()">${_restTimer.running ? 'Pause' : 'Resume'}</button>
        <button class="btn btn-sm" onclick="addRestTimerSeconds(15)">+15s</button>
        <button class="btn btn-ghost btn-sm" onclick="stopRestTimer()">x</button>
      </div>
    </div>
  `;
}

// Quick-start helper used by the "start rest timer" buttons throughout the
// workout log, uses the configurable default duration.
function quickStartRestTimer(label) {
  startRestTimer(STATE.workoutPlan.restTimerSeconds || 90, label);
}
