/* ============================================================
   BARCODE SCANNING
   Uses the browser's native BarcodeDetector when available and runs the
   bundled @zxing/browser decoder as the cross-browser fallback. Safari/iOS
   does not provide BarcodeDetector, so native-only scanning would silently
   fail there. ZXing is lazy-loaded only when a scanning page is opened.

   Barcode -> nutrition lookup uses Open Food Facts (openfoodfacts.org,
   free, no API key, Open Database License), which is specifically a
   barcode-indexed product database, a good complement to USDA search
   for packaged/branded foods.
   ============================================================ */

// IMPORTANT: this must point at the actual UMD bundle, not just the bare
// package. jsDelivr's package.json auto-resolution falls back to the "main"
// field when there's no "jsdelivr" field, and @zxing/browser's "main" is its
// CommonJS build (require/module.exports), which is not valid as a plain
// <script> tag, it "loads" (network-wise) but defines nothing, silently
// leaving ZXingBrowser undefined. Pinning the exact umd/ path avoids that.
const ZXING_BROWSER_CDN = 'js/vendor/zxing-browser.min.js';
const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product/';

function loadZXing() {
  if (typeof ZXingBrowser !== 'undefined') return Promise.resolve();
  return loadOptionalScript(ZXING_BROWSER_CDN, 'ZXingBrowser').then(() => undefined).catch(error => {
    throw new Error(`Could not load the barcode scanning library (${error.message})`);
  });
}

let _zxingReader = null;
let _zxingControls = null;
let _barcodeTrack = null;
let _barcodeCapabilities = {};
let _barcodeDevices = [];
let _barcodeStallTimer = null;
let _barcodeNativeTimer = null;
let _barcodeScanToken = 0;
let _barcodeDetectionLocked = false;
let _barcodePermissionState = 'not reported';

const RETAIL_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

function createBarcodeReader() {
  const formatEnum = ZXingBrowser.BarcodeFormat || {};
  const formats = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF']
    .map(key => formatEnum[key])
    .filter(value => Number.isFinite(value));
  const reader = new ZXingBrowser.BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 500,
    tryPlayVideoTimeout: 8000,
  });
  // The browser bundle exposes BarcodeFormat but not DecodeHintType. Its public
  // setter supplies the internal hint safely and avoids spending frames trying
  // QR/PDF417/Data Matrix formats a packaged-food scanner does not need.
  if (formats.length) reader.possibleFormats = formats;
  return reader;
}

function barcodeVideoConstraints(deviceId) {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
    // 720p is detailed enough for retail bars without making a slower phone
    // decode a two-megapixel frame every 120ms. These are preferences, not
    // requirements; the browser can choose what its camera actually supports.
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };
}

function barcodeCameraLabel(device, index) {
  const raw = String(device?.label || '').trim();
  if (!raw) return `Camera ${index + 1}`;
  const lower = raw.toLowerCase();
  const notes = [];
  if (/back|rear|environment/.test(lower)) notes.push('rear');
  if (/front|user|facetime/.test(lower)) notes.push('front');
  if (/ultra.?wide|0\.5x/.test(lower)) notes.push('ultrawide—may not focus close');
  if (/macro/.test(lower)) notes.push('macro');
  return `${raw}${notes.length ? ` (${notes.join(', ')})` : ''}`;
}

function setBarcodeStatus(message) {
  UI.barcodeStatus = message;
  const status = document.getElementById('barcode-status');
  if (status) status.textContent = message;
}

function setBarcodeDiagnostics(message) {
  UI.barcodeDiagnostics = message;
  const output = document.getElementById('barcode-diagnostics');
  if (output) output.textContent = message;
}

function renderBarcodeScanner() {
  const scanDistance = usesImperialUnits() ? 'about 4-6 inches' : 'about 10-15 cm';
  return `
    <div class="barcode-scanner-panel">
      <p class="barcode-status" id="barcode-status" role="status" aria-live="polite">${escapeAttr(UI.barcodeStatus || 'Point your camera at a product barcode.')}</p>
      <div class="barcode-video-shell">
        <video id="barcode-video" class="barcode-video" muted playsinline></video>
        <div class="barcode-aim" aria-hidden="true"><span></span></div>
      </div>
      <div class="barcode-camera-tools">
        <div class="field" id="barcode-camera-field" hidden><label>Camera / lens</label><select id="barcode-camera-select" onchange="switchBarcodeCamera(this.value)"></select></div>
        <div class="field" id="barcode-zoom-field" hidden><label>Camera zoom</label><input id="barcode-zoom" type="range" oninput="setBarcodeCameraZoom(this.value)"></div>
        <button class="btn btn-sm" id="barcode-torch-button" hidden onclick="toggleBarcodeTorch()">Toggle light</button>
        <button class="btn btn-sm" id="barcode-refocus-button" hidden onclick="refocusBarcodeCamera()">Refocus</button>
        <button class="btn btn-sm" id="barcode-next-camera-button" hidden onclick="tryNextBarcodeCamera()">Try next camera</button>
      </div>
      <div class="barcode-primary-actions">
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('barcode-photo-input').click()">Scan a photo</button>
        <input class="sr-only" id="barcode-photo-input" type="file" accept="image/*" capture="environment" onchange="scanBarcodePhoto(this.files && this.files[0]); this.value=''">
        <button class="btn btn-sm" onclick="restartBarcodeScan()">Restart camera</button>
        <button class="btn btn-ghost btn-sm" onclick="closeBarcodeScanner()">Cancel</button>
      </div>
      <p class="hint">“Scan a photo” opens the device's normal camera, which often chooses and focuses the lens better than a browser video feed. The image stays on this device and is never uploaded.</p>
      <div class="barcode-manual-entry">
        <div class="field"><label>Type the barcode instead</label><input id="manual-barcode" inputmode="numeric" autocomplete="off" placeholder="Digits below the barcode" onkeydown="if(event.key==='Enter') lookupManualBarcode()"></div>
        <button class="btn btn-sm" onclick="lookupManualBarcode()">Look up</button>
      </div>
      <p class="hint" style="margin-top:8px;">For live scanning: use even light, avoid glare, keep the full barcode inside the guide, and hold steady ${scanDistance} away. If the bars stay blurry, move farther back, add a little zoom, tap Refocus, or Try next camera—the first rear lens on multi-camera phones is sometimes ultrawide.</p>
      <details class="barcode-diagnostics"><summary>Scanner diagnostics</summary><pre id="barcode-diagnostics">${escapeAttr(UI.barcodeDiagnostics || buildBasicBarcodeDiagnostics())}</pre><button class="btn btn-sm" onclick="copyBarcodeDiagnostics()">Copy diagnostics</button></details>
    </div>
  `;
}

function buildBasicBarcodeDiagnostics() {
  return [
    `Secure context: ${window.isSecureContext ? 'yes' : 'no'}`,
    `Camera API: ${navigator.mediaDevices?.getUserMedia ? 'available' : 'unavailable'}`,
    `Camera permission: ${_barcodePermissionState}`,
    `Native detector: ${typeof BarcodeDetector !== 'undefined' ? 'available' : 'unavailable (ZXing fallback active)'}`,
    `Browser: ${navigator.userAgent || 'unknown'}`,
  ].join('\n');
}

function openBarcodeScanner() {
  UI.barcodeScannerOpen = true;
  UI.barcodeStatus = 'Loading scanner...';
  UI.barcodeDiagnostics = buildBasicBarcodeDiagnostics();
  UI.mealBuilderOpen = false;
  UI.foodAdjustDraft = null;
  render();
  startBarcodeScan();
}

function closeBarcodeScanner() {
  stopBarcodeScan();
  UI.barcodeScannerOpen = false;
  render();
}

async function startBarcodeScan() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setBarcodeStatus(!window.isSecureContext
      ? 'Camera scanning is blocked because this page is not using HTTPS. Scan a photo or type the barcode instead.'
      : 'This browser does not expose camera access. Scan a photo or type the barcode instead.');
    return;
  }
  const scanToken = ++_barcodeScanToken;
  _barcodeDetectionLocked = false;
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: 'camera' }).then(permission => {
      _barcodePermissionState = permission.state || 'not reported';
      setBarcodeDiagnostics(buildBasicBarcodeDiagnostics());
    }).catch(() => { /* Camera permission querying is not implemented everywhere. */ });
  }
  try {
    await loadZXing();
  } catch (e) {
    console.error(e);
    UI.barcodeStatus = `Could not load the scanner (${(e && e.message) || 'unknown error'}) - you can search by name instead.`;
    render();
    return;
  }

  const video = document.getElementById('barcode-video');
  if (!video) return; // user navigated away before this resolved

  try {
    // delayBetweenScanAttempts defaults to 500ms, faster here so a barcode gets
    // picked up quickly instead of needing to hold it steady for a while.
    _zxingReader = createBarcodeReader();
    setBarcodeStatus('Starting the rear camera...');
    const onFrame = (result) => {
      if (result) finishBarcodeDetection(result.getText());
      // Per-frame "not found" errors are normal while scanning.
    };
    let controls, lastError;
    const modes = [
      { label: UI.barcodeDeviceId ? 'the selected camera' : 'the rear camera', video: barcodeVideoConstraints(UI.barcodeDeviceId) },
      ...(UI.barcodeDeviceId ? [{ label: 'automatic rear-camera selection', video: barcodeVideoConstraints('') }] : []),
      { label: 'basic device defaults', video: true },
    ];
    for (let index = 0; index < modes.length && !controls; index++) {
      if (index) setBarcodeStatus(`Retrying with ${modes[index].label}...`);
      try {
        controls = await _zxingReader.decodeFromConstraints({ video: modes[index].video }, video, onFrame);
        if (index && UI.barcodeDeviceId) UI.barcodeDeviceId = '';
      } catch (error) {
        lastError = error;
        if (['NotAllowedError', 'SecurityError'].includes(error?.name)) break;
      }
    }
    if (!controls) throw lastError || new Error('No compatible camera mode started.');
    if (scanToken !== _barcodeScanToken || !UI.barcodeScannerOpen) {
      try { controls.stop(); } catch (e) { /* stale scan already ended */ }
      return;
    }
    _zxingControls = controls;
    await configureBarcodeCamera(video, scanToken);
    startNativeBarcodeDetection(video, scanToken);
    clearTimeout(_barcodeStallTimer);
    _barcodeStallTimer = setTimeout(() => {
      if (scanToken !== _barcodeScanToken || _barcodeDetectionLocked) return;
      setBarcodeStatus(_barcodeDevices.length > 1
        ? 'No read yet. If the image is blurry, tap Refocus or Try next camera. Scan a photo is the most reliable fallback.'
        : 'No read yet. Move farther back until the bars are sharp, or use Scan a photo for the device’s native autofocus.');
    }, 9000);
  } catch (e) {
    console.error(e);
    let msg;
    msg = barcodeCameraErrorMessage(e);
    setBarcodeStatus(msg);
    setBarcodeDiagnostics(`${buildBasicBarcodeDiagnostics()}\nCamera error: ${e?.name || 'Error'} — ${e?.message || 'unknown'}`);
  }
}

function barcodeCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Camera access is blocked. Allow camera permission for this site in browser settings, then tap Restart camera—or use Scan a photo.';
  if (error?.name === 'NotFoundError') return 'No camera was reported by this browser. Use Scan a photo or type the barcode instead.';
  if (error?.name === 'NotReadableError' || error?.name === 'AbortError') return 'The camera is busy or the device could not start it. Close other camera apps, then tap Restart camera—or use Scan a photo.';
  if (error?.name === 'OverconstrainedError') return 'This camera rejected the requested video mode. Tap Restart camera to use basic settings, or use Scan a photo.';
  return `Could not start the camera (${error?.message || 'unknown error'}). Try another browser, Scan a photo, or type the barcode.`;
}

// Many webcams (laptops especially) default to a fixed focus distance tuned
// for video calls, which is often the wrong distance for holding a barcode
// up close. Where the browser/hardware exposes focus control (support is
// inconsistent, mainly Chrome on some devices), this asks for continuous
// autofocus instead. Silently does nothing if unsupported, this is a
// nice-to-have, not something to fail loudly over.
async function configureBarcodeCamera(video, scanToken) {
  try {
    const stream = video.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks && stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    _barcodeTrack = track;
    const caps = track.getCapabilities();
    _barcodeCapabilities = caps || {};
    const advanced = {};
    if (caps.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
    if (caps.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
    if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
    const zoomField = document.getElementById('barcode-zoom-field');
    const zoom = document.getElementById('barcode-zoom');
    if (caps.zoom && zoom && zoomField) {
      const settings = track.getSettings ? track.getSettings() : {};
      zoom.min = caps.zoom.min; zoom.max = caps.zoom.max; zoom.step = caps.zoom.step || 0.1;
      zoom.value = settings.zoom || caps.zoom.min;
      zoomField.hidden = false;
    }
    const torchButton = document.getElementById('barcode-torch-button');
    if (caps.torch && torchButton) torchButton.hidden = false;
    const refocusButton = document.getElementById('barcode-refocus-button');
    if (caps.focusMode?.some(mode => ['continuous', 'single-shot'].includes(mode)) && refocusButton) refocusButton.hidden = false;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    if (scanToken !== _barcodeScanToken) return;
    _barcodeDevices = devices;
    const cameraField = document.getElementById('barcode-camera-field');
    const cameraSelect = document.getElementById('barcode-camera-select');
    if (devices.length > 1 && cameraField && cameraSelect) {
      cameraSelect.innerHTML = devices.map((device, index) => `<option value="${escapeAttr(device.deviceId)}" ${device.deviceId === track.getSettings?.().deviceId ? 'selected' : ''}>${escapeAttr(barcodeCameraLabel(device, index))}</option>`).join('');
      cameraField.hidden = false;
      const nextButton = document.getElementById('barcode-next-camera-button');
      if (nextButton) nextButton.hidden = false;
    }
    const settings = track.getSettings ? track.getSettings() : {};
    const currentIndex = Math.max(0, devices.findIndex(device => device.deviceId === settings.deviceId));
    const cameraName = barcodeCameraLabel(devices[currentIndex], currentIndex);
    setBarcodeStatus(`Scanning with ${cameraName}${settings.width ? ` at ${settings.width}×${settings.height}` : ''}. Keep the full barcode inside the guide.`);
    setBarcodeDiagnostics([
      buildBasicBarcodeDiagnostics(),
      `Selected camera: ${cameraName}`,
      `Video: ${settings.width || '?'}×${settings.height || '?'} at ${settings.frameRate || '?'} fps`,
      `Facing: ${settings.facingMode || 'not reported'}`,
      `Focus: ${settings.focusMode || (caps.focusMode?.join(', ') || 'not reported')}`,
      `Cameras reported: ${devices.length}`,
    ].join('\n'));
  } catch (e) { /* focus control not supported here, that's fine */ }
}

function setBarcodeCameraZoom(value) {
  if (!_barcodeTrack) return;
  _barcodeTrack.applyConstraints({ advanced: [{ zoom: Number(value) }] }).catch(() => toast('This camera could not change zoom.'));
}

async function refocusBarcodeCamera() {
  if (!_barcodeTrack) return;
  try {
    if (_barcodeCapabilities.focusMode?.includes('single-shot')) {
      await _barcodeTrack.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
    }
    if (_barcodeCapabilities.focusMode?.includes('continuous')) {
      await _barcodeTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    }
    setBarcodeStatus('Refocusing—hold the barcode still and move back until every bar is sharp.');
  } catch (e) {
    toast('This camera does not allow browser-controlled focus. Try another camera or Scan a photo.');
  }
}

let _barcodeTorchOn = false;
function toggleBarcodeTorch() {
  if (!_barcodeTrack) return;
  _barcodeTorchOn = !_barcodeTorchOn;
  _barcodeTrack.applyConstraints({ advanced: [{ torch: _barcodeTorchOn }] }).catch(() => {
    _barcodeTorchOn = false; toast('This camera could not control its light.');
  });
}

function switchBarcodeCamera(deviceId) {
  UI.barcodeDeviceId = deviceId;
  stopBarcodeScan();
  UI.barcodeStatus = 'Switching camera...';
  startBarcodeScan();
}

function tryNextBarcodeCamera() {
  if (_barcodeDevices.length < 2) { toast('This browser only reported one camera.'); return; }
  const currentId = _barcodeTrack?.getSettings?.().deviceId || UI.barcodeDeviceId;
  const currentIndex = _barcodeDevices.findIndex(device => device.deviceId === currentId);
  const next = _barcodeDevices[(currentIndex + 1 + _barcodeDevices.length) % _barcodeDevices.length];
  if (next) switchBarcodeCamera(next.deviceId);
}

function restartBarcodeScan() {
  stopBarcodeScan();
  setBarcodeStatus('Restarting camera...');
  startBarcodeScan();
}

function lookupManualBarcode() {
  const barcode = String(document.getElementById('manual-barcode')?.value || '').replace(/\D/g, '');
  if (barcode.length < 6 || barcode.length > 18) { toast('Enter the 6–18 digits printed below the barcode.'); return; }
  stopBarcodeScan();
  onBarcodeDetected(barcode);
}

function stopBarcodeScan() {
  _barcodeScanToken++;
  clearTimeout(_barcodeStallTimer);
  clearTimeout(_barcodeNativeTimer);
  _barcodeStallTimer = null;
  _barcodeNativeTimer = null;
  if (_zxingControls) {
    try { _zxingControls.stop(); } catch (e) { /* already stopped */ }
    _zxingControls = null;
  }
  if (_barcodeTrack) {
    try { _barcodeTrack.stop(); } catch (e) { /* already stopped */ }
  }
  _barcodeTrack = null;
  _barcodeCapabilities = {};
  _barcodeTorchOn = false;
}

function finishBarcodeDetection(value) {
  const barcode = String(value || '').replace(/\D/g, '');
  if (_barcodeDetectionLocked || barcode.length < 6 || barcode.length > 18) return;
  _barcodeDetectionLocked = true;
  stopBarcodeScan();
  onBarcodeDetected(barcode);
}

async function startNativeBarcodeDetection(video, scanToken) {
  if (typeof BarcodeDetector === 'undefined') return;
  try {
    const supported = typeof BarcodeDetector.getSupportedFormats === 'function'
      ? await BarcodeDetector.getSupportedFormats()
      : RETAIL_BARCODE_FORMATS;
    const formats = RETAIL_BARCODE_FORMATS.filter(format => supported.includes(format));
    if (!formats.length || scanToken !== _barcodeScanToken) return;
    const detector = new BarcodeDetector({ formats });
    const detect = async () => {
      if (scanToken !== _barcodeScanToken || _barcodeDetectionLocked || !UI.barcodeScannerOpen) return;
      try {
        const results = await detector.detect(video);
        if (results?.[0]?.rawValue) { finishBarcodeDetection(results[0].rawValue); return; }
      } catch (e) { /* ZXing keeps scanning if native detection dislikes a frame */ }
      _barcodeNativeTimer = setTimeout(detect, 180);
    };
    detect();
  } catch (e) { /* Native detector is an optional accelerator only. */ }
}

async function scanBarcodePhoto(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { toast('Choose a photo of a barcode.'); return; }
  if (file.size > 30 * 1024 * 1024) { toast('That image is too large. Try a normal camera photo.'); return; }
  _barcodeDetectionLocked = false;
  stopBarcodeScan();
  setBarcodeStatus('Analyzing the photo on this device...');
  try {
    await loadZXing();
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('The image could not be opened.'));
        image.src = objectUrl;
      });
      const maxSide = 2400;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Image processing is unavailable.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (typeof BarcodeDetector !== 'undefined') {
        try {
          const supported = await BarcodeDetector.getSupportedFormats();
          const formats = RETAIL_BARCODE_FORMATS.filter(format => supported.includes(format));
          if (formats.length) {
            const nativeResults = await new BarcodeDetector({ formats }).detect(canvas);
            if (nativeResults?.[0]?.rawValue) { finishBarcodeDetection(nativeResults[0].rawValue); return; }
          }
        } catch (e) { /* fall through to bundled decoder */ }
      }
      const result = createBarcodeReader().decodeFromCanvas(canvas);
      finishBarcodeDetection(result.getText());
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.error(error);
    setBarcodeStatus('No barcode was found in that photo. Fill most of the picture with the sharp, flat barcode and try again—or type the digits below it.');
    setBarcodeDiagnostics(`${buildBasicBarcodeDiagnostics()}\nPhoto decode: ${error?.name || 'Error'} — ${error?.message || 'not found'}`);
  }
}

async function copyBarcodeDiagnostics() {
  const text = UI.barcodeDiagnostics || buildBasicBarcodeDiagnostics();
  try { await navigator.clipboard.writeText(text); toast('Scanner diagnostics copied.'); }
  catch (e) { toast('Could not copy diagnostics automatically.'); }
}

async function onBarcodeDetected(barcode) {
  UI.barcodeStatus = `Found barcode ${barcode}, looking it up...`;
  render();
  try {
    const res = await fetch(`${OPEN_FOOD_FACTS_URL}${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`);
    if (!res.ok) throw new Error('Open Food Facts request failed: ' + res.status);
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      UI.barcodeStatus = `No match found for ${barcode} in the open product database. You can search by name or add it as a custom food instead.`;
      render();
      return;
    }
    const p = data.product;
    const n = p.nutriments || {};
    const brandSuffix = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
    const baseName = p.product_name || `Scanned item ${barcode}`;

    // Prefer the product's own per-serving values (as printed on its actual
    // Nutrition Facts panel) over per-100g, when Open Food Facts has them,
    // that's the real gap this used to have: serving_size was being fetched
    // but never actually used, everything defaulted to 100g regardless.
    const hasServingData = n['energy-kcal_serving'] != null && p.serving_size;
    let food;
    if (hasServingData) {
      food = {
        name: `${baseName}${brandSuffix} (${p.serving_size})`,
        kcal: n['energy-kcal_serving'] || 0,
        protein: n['proteins_serving'] || 0,
        carbs: n['carbohydrates_serving'] || 0,
        fat: n['fat_serving'] || 0,
      };
    } else {
      const kcal100 = n['energy-kcal_100g'] != null ? n['energy-kcal_100g']
        : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : 0); // energy_100g is kJ when kcal isn't provided directly
      food = {
        name: `${baseName}${brandSuffix} (100g)`,
        kcal: kcal100 || 0,
        protein: n['proteins_100g'] || 0,
        carbs: n['carbohydrates_100g'] || 0,
        fat: n['fat_100g'] || 0,
      };
    }
    UI.barcodeScannerOpen = false;
    startFoodAdjustDraft(food);
    render();
    toast(hasServingData ? 'Found it! Set to one labeled serving, check the numbers before adding.' : 'Found it! No serving size on file for this one, defaulted to 100g, check the numbers before adding.');
  } catch (e) {
    console.error(e);
    UI.barcodeStatus = 'Lookup failed (check your connection). You can search by name instead.';
    render();
  }
}
