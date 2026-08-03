/* ============================================================
   BARCODE SCANNING
   Uses @zxing/browser (MIT license, pure JS) rather than the native
   BarcodeDetector API, since Safari/iOS doesn't implement that API at
   all, native-API-only would silently fail on every iPhone. The
   library is bundled locally and lazy-loaded only when a scanning page is
   opened, not on every page load.

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

let _zxingLoadPromise = null;
function loadZXing() {
  if (typeof ZXingBrowser !== 'undefined') return Promise.resolve();
  if (_zxingLoadPromise) return _zxingLoadPromise;
  _zxingLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ZXING_BROWSER_CDN;
    script.onload = () => {
      // A script can "load" (network success) while still failing to define
      // what we need (wrong build, blocked by an extension, etc.), so verify
      // the actual global exists before declaring success.
      if (typeof ZXingBrowser === 'undefined') {
        reject(new Error('Scanner library loaded but did not initialize correctly.'));
      } else {
        resolve();
      }
    };
    script.onerror = () => reject(new Error('Could not load the barcode scanning library (check your connection).'));
    document.head.appendChild(script);
  });
  return _zxingLoadPromise;
}

let _zxingReader = null;
let _zxingControls = null;
let _barcodeTrack = null;

function renderBarcodeScanner() {
  const scanDistance = usesImperialUnits() ? 'about 4-6 inches' : 'about 10-15 cm';
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-bottom:14px;">
      <p class="hint" style="margin-bottom:10px;">${escapeAttr(UI.barcodeStatus || 'Point your camera at a product barcode.')}</p>
      <video id="barcode-video" class="barcode-video" muted playsinline></video>
      <div class="barcode-camera-tools">
        <div class="field" id="barcode-camera-field" hidden><label>Camera</label><select id="barcode-camera-select" onchange="switchBarcodeCamera(this.value)"></select></div>
        <div class="field" id="barcode-zoom-field" hidden><label>Camera zoom</label><input id="barcode-zoom" type="range" oninput="setBarcodeCameraZoom(this.value)"></div>
        <button class="btn btn-sm" id="barcode-torch-button" hidden onclick="toggleBarcodeTorch()">Toggle light</button>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="closeBarcodeScanner()">Cancel</button>
      </div>
      <div class="barcode-manual-entry">
        <div class="field"><label>Type the barcode instead</label><input id="manual-barcode" inputmode="numeric" autocomplete="off" placeholder="Digits below the barcode" onkeydown="if(event.key==='Enter') lookupManualBarcode()"></div>
        <button class="btn btn-sm" onclick="lookupManualBarcode()">Look up</button>
      </div>
      <p class="hint" style="margin-top:8px;">Struggling to get a read? A few things that matter more than the software: good even lighting (avoid glare on the barcode), hold it flat and steady ${scanDistance} from the camera, and make sure the whole barcode is in frame. Laptop webcams especially can have slow or fixed-distance autofocus, if it won't lock on, try tilting slightly or moving a bit further back.</p>
      <p class="hint" style="margin-top:4px;">Still not working? Barcode scanning needs camera access and a secure (https) connection. You can always search by name instead.</p>
    </div>
  `;
}

function openBarcodeScanner() {
  UI.barcodeScannerOpen = true;
  UI.barcodeStatus = 'Loading scanner...';
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
    _zxingReader = new ZXingBrowser.BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 100 });
    UI.barcodeStatus = 'Point your camera at a product barcode.';
    const videoConstraints = UI.barcodeDeviceId
      ? { deviceId: { exact: UI.barcodeDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    _zxingControls = await _zxingReader.decodeFromConstraints(
      {
        video: videoConstraints,
      },
      video,
      (result, err, controls) => {
        if (result) {
          controls.stop();
          _zxingControls = null;
          onBarcodeDetected(result.getText());
        }
        // per-frame "not found" errors are normal while scanning, not fatal, ignore them
      }
    );
    configureBarcodeCamera(video);
  } catch (e) {
    console.error(e);
    let msg;
    if (e && e.name === 'NotAllowedError') {
      msg = 'Camera access was denied, allow camera access to scan a barcode, or search by name instead.';
    } else if (e && e.name === 'NotFoundError') {
      msg = 'No camera was found on this device, you can search by name instead.';
    } else {
      msg = `Could not start the camera (${(e && e.message) || 'unknown error'}). Try Chrome or Safari, or search by name instead.`;
    }
    UI.barcodeStatus = msg;
    render();
  }
}

// Many webcams (laptops especially) default to a fixed focus distance tuned
// for video calls, which is often the wrong distance for holding a barcode
// up close. Where the browser/hardware exposes focus control (support is
// inconsistent, mainly Chrome on some devices), this asks for continuous
// autofocus instead. Silently does nothing if unsupported, this is a
// nice-to-have, not something to fail loudly over.
async function configureBarcodeCamera(video) {
  try {
    const stream = video.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks && stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    _barcodeTrack = track;
    const caps = track.getCapabilities();
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
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    const cameraField = document.getElementById('barcode-camera-field');
    const cameraSelect = document.getElementById('barcode-camera-select');
    if (devices.length > 1 && cameraField && cameraSelect) {
      cameraSelect.innerHTML = devices.map((device, index) => `<option value="${escapeAttr(device.deviceId)}" ${device.deviceId === track.getSettings?.().deviceId ? 'selected' : ''}>${escapeAttr(device.label || `Camera ${index + 1}`)}</option>`).join('');
      cameraField.hidden = false;
    }
  } catch (e) { /* focus control not supported here, that's fine */ }
}

function setBarcodeCameraZoom(value) {
  if (!_barcodeTrack) return;
  _barcodeTrack.applyConstraints({ advanced: [{ zoom: Number(value) }] }).catch(() => toast('This camera could not change zoom.'));
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

function lookupManualBarcode() {
  const barcode = String(document.getElementById('manual-barcode')?.value || '').replace(/\D/g, '');
  if (barcode.length < 6 || barcode.length > 18) { toast('Enter the 6–18 digits printed below the barcode.'); return; }
  stopBarcodeScan();
  onBarcodeDetected(barcode);
}

function stopBarcodeScan() {
  if (_zxingControls) {
    try { _zxingControls.stop(); } catch (e) { /* already stopped */ }
    _zxingControls = null;
  }
  _barcodeTrack = null;
  _barcodeTorchOn = false;
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
