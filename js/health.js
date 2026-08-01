/* ============================================================
   OPTIONAL NATIVE STEP IMPORT

   A normal website/PWA cannot read Apple Health or Android Health Connect.
   Native wrappers may expose one deliberately small message bridge instead:

     web -> native: { action: 'readSteps', requestId, date: 'YYYY-MM-DD' }
     native -> web: ForgeHealthBridge.resolve(requestId, result)

   The result is { ok: true, steps, source } or { ok: false, error }.
   Only a daily total is placed in Forge's existing local state. The browser
   version remains unchanged when neither bridge is installed.
   ============================================================ */

const HEALTH_IMPORT_TIMEOUT_MS = 45000;
const _healthRequests = new Map();
let _healthImportBusy = false;

function getHealthImportEnvironment() {
  const appleHandler = typeof window !== 'undefined'
    ? window.webkit?.messageHandlers?.forgeHealth
    : null;
  if (appleHandler && typeof appleHandler.postMessage === 'function') {
    return { available: true, source: 'apple-health', label: 'Apple Health', transport: 'ios' };
  }

  const androidHandler = typeof window !== 'undefined'
    ? window.ForgeAndroidHealth
    : null;
  if (androidHandler && typeof androidHandler.postMessage === 'function') {
    return { available: true, source: 'health-connect', label: 'Health Connect', transport: 'android' };
  }

  return { available: false, source: null, label: null, transport: null };
}

function sendHealthRequest(action, payload = {}) {
  const environment = getHealthImportEnvironment();
  if (!environment.available) {
    return Promise.reject(new Error('Health step import is available in the Forge iOS or Android app.'));
  }

  const requestId = `health-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const message = { action, requestId, ...payload };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      _healthRequests.delete(requestId);
      reject(new Error('The health provider did not respond. Please try again.'));
    }, HEALTH_IMPORT_TIMEOUT_MS);
    _healthRequests.set(requestId, { resolve, reject, timeout });

    try {
      if (environment.transport === 'ios') {
        window.webkit.messageHandlers.forgeHealth.postMessage(message);
      } else {
        window.ForgeAndroidHealth.postMessage(JSON.stringify(message));
      }
    } catch (error) {
      clearTimeout(timeout);
      _healthRequests.delete(requestId);
      reject(error);
    }
  });
}

const ForgeHealthBridge = {
  resolve(requestId, result) {
    const pending = _healthRequests.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    _healthRequests.delete(requestId);
    if (result?.ok) pending.resolve(result);
    else pending.reject(new Error(result?.error || 'Step permission was not granted.'));
  },
};

if (typeof window !== 'undefined') window.ForgeHealthBridge = ForgeHealthBridge;

async function importStepsFromHealth(date) {
  if (_healthImportBusy) return;
  _healthImportBusy = true;
  render();
  try {
    const result = await sendHealthRequest('readSteps', { date: date || todayISO() });
    const steps = Math.max(0, Math.round(Number(result.steps) || 0));
    submitStepCheckin(steps, date, result.source || getHealthImportEnvironment().source);
    toast(`${steps.toLocaleString()} steps imported from ${getHealthImportEnvironment().label}.`);
  } catch (error) {
    toast(error?.message || 'Steps could not be imported.');
  } finally {
    _healthImportBusy = false;
    render();
  }
}

function renderHealthImportControl(date) {
  const environment = getHealthImportEnvironment();
  if (!environment.available) return '';
  return `<button class="btn btn-sm health-import-btn" onclick="importStepsFromHealth('${date}')" ${_healthImportBusy ? 'disabled' : ''}>${_healthImportBusy ? 'Reading…' : `Import from ${escapeAttr(environment.label)}`}</button>`;
}

function formatStepSource(entry) {
  if (!entry || !entry.source || entry.source === 'manual') return '';
  const labels = { 'apple-health': 'Apple Health', 'health-connect': 'Health Connect', 'samsung-health': 'Samsung Health' };
  return labels[entry.source] || 'Health provider';
}
