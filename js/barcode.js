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

function renderBarcodeScanner() {
  const scanDistance = usesImperialUnits() ? 'about 4-6 inches' : 'about 10-15 cm';
  return `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:calc(var(--radius)*0.6); padding:14px; margin-bottom:14px;">
      <p class="hint" style="margin-bottom:10px;">${escapeAttr(UI.barcodeStatus || 'Point your camera at a product barcode.')}</p>
      <video id="barcode-video" style="width:100%; max-height:280px; border-radius:calc(var(--radius)*0.5); background:#000; object-fit:cover;" muted playsinline></video>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn btn-ghost btn-sm" onclick="closeBarcodeScanner()">Cancel</button>
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
    _zxingControls = await _zxingReader.decodeFromConstraints(
      {
        video: {
          facingMode: 'environment',
          // Higher resolution gives a barcode more actual pixels to be read
          // from, these are "ideal" hints, so a camera that can't do 1080p
          // just falls back to its best available resolution instead of
          // failing outright.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
    tryEnableContinuousFocus(video);
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
function tryEnableContinuousFocus(video) {
  try {
    const stream = video.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks && stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    const caps = track.getCapabilities();
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
      track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
  } catch (e) { /* focus control not supported here, that's fine */ }
}

function stopBarcodeScan() {
  if (_zxingControls) {
    try { _zxingControls.stop(); } catch (e) { /* already stopped */ }
    _zxingControls = null;
  }
}

async function onBarcodeDetected(barcode) {
  UI.barcodeStatus = `Found barcode ${barcode}, looking it up...`;
  render();
  try {
    const res = await fetch(`${OPEN_FOOD_FACTS_URL}${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,serving_size`);
    if (!res.ok) throw new Error('Open Food Facts request failed: ' + res.status);
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      UI.barcodeStatus = `No match found for ${barcode} in the open product database. You can search by name or add it as a custom food instead.`;
      render();
      return;
    }
    const p = data.product;
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] != null ? n['energy-kcal_100g']
      : (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : 0); // energy_100g is kJ when kcal isn't provided directly
    const name = p.product_name
      ? `${p.product_name}${p.brands ? ' (' + p.brands.split(',')[0].trim() + ')' : ''} (100g)`
      : `Scanned item ${barcode} (100g)`;
    const food = {
      name,
      kcal: kcal || 0,
      protein: n['proteins_100g'] || 0,
      carbs: n['carbohydrates_100g'] || 0,
      fat: n['fat_100g'] || 0,
    };
    UI.barcodeScannerOpen = false;
    startFoodAdjustDraft(food);
    render();
    toast('Found it! Check the numbers before adding.');
  } catch (e) {
    console.error(e);
    UI.barcodeStatus = 'Lookup failed (check your connection). You can search by name instead.';
    render();
  }
}
