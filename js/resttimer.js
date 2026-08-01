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
  dismissHandle: null,
};

// Primed during startRestTimer() (a user-gesture click), not at completion
// time, browsers require an AudioContext to be created/resumed within a user
// gesture or it stays silently suspended, so priming it early and reusing it
// is what makes the completion beep actually audible later.
let _restTimerAudioCtx = null;
function primeRestTimerAudio() {
  try {
    if (!_restTimerAudioCtx) {
      _restTimerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_restTimerAudioCtx.state === 'suspended') _restTimerAudioCtx.resume();
  } catch (e) { /* Web Audio not supported here, sound just won't play */ }
}
function playRestTimerSound() {
  const ctx = _restTimerAudioCtx;
  if (!ctx) return;
  try {
    const beep = (startTime, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };
    const now = ctx.currentTime;
    beep(now, 880);
    beep(now + 0.32, 880);
    beep(now + 0.64, 1108);
  } catch (e) { /* not fatal, vibration/toast still fire */ }
}

function startRestTimer(seconds, label) {
  stopRestTimerInterval();
  stopRestTimerDismiss();
  primeRestTimerAudio();
  const duration = Math.max(1, Number(seconds) || 90);
  _restTimer = {
    running: true,
    secondsLeft: duration,
    totalSeconds: duration,
    label: label || 'Rest',
    tickHandle: null,
    dismissHandle: null,
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
    playRestTimerSound();
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) { /* not supported */ } }
    toast(`${_restTimer.label} done!`);
    render();
    // Leave the completed state visible long enough to notice, then get it out
    // of the way until another set explicitly starts a new timer.
    _restTimer.dismissHandle = setTimeout(stopRestTimer, 5000);
    return;
  }
  updateRestTimerDisplay();
}

function pauseRestTimer() {
  _restTimer.running = !_restTimer.running;
  if (_restTimer.running) {
    primeRestTimerAudio();
    _restTimer.tickHandle = setInterval(restTimerTick, 1000);
  } else {
    stopRestTimerInterval();
  }
  render();
}

function stopRestTimer() {
  stopRestTimerInterval();
  stopRestTimerDismiss();
  _restTimer = { running: false, secondsLeft: 0, totalSeconds: 0, label: '', tickHandle: null, dismissHandle: null };
  render();
}

function addRestTimerSeconds(delta) {
  stopRestTimerDismiss();
  const wasComplete = _restTimer.secondsLeft <= 0;
  _restTimer.secondsLeft = Math.max(0, _restTimer.secondsLeft + delta);
  _restTimer.totalSeconds = Math.max(_restTimer.totalSeconds, _restTimer.secondsLeft);
  if (wasComplete && _restTimer.secondsLeft > 0) {
    _restTimer.running = true;
    _restTimer.tickHandle = setInterval(restTimerTick, 1000);
    render();
    return;
  }
  updateRestTimerDisplay();
}

function stopRestTimerInterval() {
  if (_restTimer.tickHandle) { clearInterval(_restTimer.tickHandle); _restTimer.tickHandle = null; }
}

function stopRestTimerDismiss() {
  if (_restTimer.dismissHandle) { clearTimeout(_restTimer.dismissHandle); _restTimer.dismissHandle = null; }
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
  if (STATE.uiPrefs.restTimerWidgetCollapsed) {
    return `
      <div class="rest-timer-widget minimized" role="timer" aria-live="polite" aria-label="Rest timer: ${escapeAttr(_restTimer.label)}">
        <button class="rest-timer-minimized-btn" onclick="toggleRememberedPanel('restTimerWidgetCollapsed')" aria-label="Expand rest timer">
          <span>${escapeAttr(_restTimer.label)}</span><strong id="rest-timer-seconds">${formatRestTime(_restTimer.secondsLeft)}</strong><span aria-hidden="true">□</span>
        </button>
      </div>
    `;
  }
  return `
    <div class="rest-timer-widget" role="timer" aria-live="polite" aria-label="Rest timer: ${escapeAttr(_restTimer.label)}">
      <div class="rest-timer-label"><span>${escapeAttr(_restTimer.label)}</span><button class="rest-timer-minimize" onclick="toggleRememberedPanel('restTimerWidgetCollapsed')" aria-label="Minimize rest timer">−</button></div>
      <div class="rest-timer-time" id="rest-timer-seconds">${formatRestTime(_restTimer.secondsLeft)}</div>
      <div class="rest-timer-track"><div class="rest-timer-fill" id="rest-timer-bar" style="width:${_restTimer.totalSeconds ? (_restTimer.secondsLeft / _restTimer.totalSeconds) * 100 : 0}%;"></div></div>
      <div class="rest-timer-controls">
        <button class="btn btn-sm" onclick="addRestTimerSeconds(-15)">-15s</button>
        ${_restTimer.secondsLeft > 0 ? `<button class="btn btn-sm" onclick="pauseRestTimer()">${_restTimer.running ? 'Pause' : 'Resume'}</button>` : '<span class="badge badge-ok">Done</span>'}
        <button class="btn btn-sm" onclick="addRestTimerSeconds(15)">+15s</button>
        <button class="btn btn-ghost btn-sm" onclick="stopRestTimer()" aria-label="Close rest timer">x</button>
      </div>
    </div>
  `;
}

// Quick-start helper used by the "start rest timer" buttons throughout the
// workout log, uses the configurable default duration.
function quickStartRestTimer(label) {
  startRestTimer(STATE.workoutPlan.restTimerSeconds || 90, label);
}
