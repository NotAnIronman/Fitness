const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Date, Map, setTimeout, clearTimeout });

vm.runInContext(`
  var window = { isSecureContext: true };
  var navigator = { mediaDevices: { getUserMedia() {} }, userAgent: 'Test Browser' };
  var UI = { barcodeStatus: '', barcodeDiagnostics: '', barcodeDeviceId: '', barcodeScannerOpen: false };
  var document = { getElementById() { return null; }, createElement() { return {}; }, head: { appendChild() {} } };
  function escapeAttr(value) { return String(value == null ? '' : value); }
  function usesImperialUnits() { return true; }
  function render() {}
  function toast() {}
  function startFoodAdjustDraft() {}
`, context);

vm.runInContext(fs.readFileSync(path.join(root, 'js/barcode.js'), 'utf8'), context, { filename: 'js/barcode.js' });
const evaluate = expression => vm.runInContext(expression, context);

vm.runInContext(fs.readFileSync(path.join(root, 'js/vendor/zxing-browser.min.js'), 'utf8'), context, { filename: 'js/vendor/zxing-browser.min.js' });
assert.equal(evaluate(`typeof ZXingBrowser.BrowserMultiFormatReader`), 'function');
assert.equal(evaluate(`ZXingBrowser.BarcodeFormat.EAN_13`), 7);
assert.equal(evaluate(`Array.from(createBarcodeReader().hints.values()).some(value => Array.isArray(value) && value.length === 7)`), true);

const automatic = evaluate(`barcodeVideoConstraints('')`);
assert.equal(automatic.facingMode.ideal, 'environment');
assert.equal(automatic.width.ideal, 1280);
assert.equal(automatic.height.ideal, 720);
assert.equal(automatic.frameRate.ideal, 30);

const selected = evaluate(`barcodeVideoConstraints('camera-2')`);
assert.equal(selected.deviceId.exact, 'camera-2');
assert.equal(selected.facingMode, undefined);

assert.match(evaluate(`barcodeCameraLabel({ label: 'Back Ultra Wide Camera' }, 0)`), /ultrawide—may not focus close/);
assert.equal(evaluate(`barcodeCameraLabel({ label: '' }, 2)`), 'Camera 3');
assert.match(evaluate(`barcodeCameraErrorMessage({ name: 'NotAllowedError' })`), /permission/i);
assert.match(evaluate(`barcodeCameraErrorMessage({ name: 'NotReadableError' })`), /busy/i);
assert.match(evaluate(`barcodeCameraErrorMessage({ name: 'OverconstrainedError' })`), /video mode/i);
const scannerMarkup = evaluate(`renderBarcodeScanner()`);
assert.match(scannerMarkup, /Scan a photo/);
assert.match(scannerMarkup, /Try next camera/);
assert.match(scannerMarkup, /Scanner diagnostics/);
assert.match(scannerMarkup, /never uploaded/);

console.log('Barcode camera constraints, lens labeling, and error guidance checks passed.');
