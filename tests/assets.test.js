const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const normalize = relative => relative.replace(/^\.\//, '').replaceAll('/', path.sep);

const index = read('index.html');
const serviceWorker = read('sw.js');
const app = read('js/app.js');
const manifest = JSON.parse(read('manifest.json'));
const precacheMatch = serviceWorker.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
assert.ok(precacheMatch, 'Service worker precache list could not be read.');
const precache = [...precacheMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(match => match[1]);

assert.equal(new Set(precache).size, precache.length, 'Service worker precache list contains duplicates.');
for (const resource of precache) {
  if (resource === './') continue;
  assert.ok(fs.existsSync(path.join(root, normalize(resource))), `Precached file is missing: ${resource}`);
}

const shippedDirectories = ['assets', 'css', 'icons', 'js'];
const browserAssetExtensions = new Set(['.css', '.js', '.png', '.svg']);
function listFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(relative) : [relative];
  });
}
const cachedFiles = new Set(precache.map(normalize));
for (const file of shippedDirectories.flatMap(listFiles).filter(file => browserAssetExtensions.has(path.extname(file)))) {
  assert.ok(cachedFiles.has(file), `Shipped asset is not available offline: ${file}`);
}

const localIndexResources = [...index.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(resource => !/^(?:https?:|data:|#)/.test(resource));
for (const resource of localIndexResources) {
  assert.ok(fs.existsSync(path.join(root, normalize(resource))), `index.html references a missing file: ${resource}`);
  assert.ok(cachedFiles.has(normalize(resource)), `index.html resource is not available offline: ${resource}`);
}

for (const icon of manifest.icons || []) {
  assert.ok(fs.existsSync(path.join(root, normalize(icon.src))), `Manifest icon is missing: ${icon.src}`);
  assert.ok(cachedFiles.has(normalize(icon.src)), `Manifest icon is not available offline: ${icon.src}`);
}

const appVersion = app.match(/const APP_VERSION = ['"]([^'"]+)['"]/i)?.[1];
const cacheVersion = serviceWorker.match(/const CACHE_VERSION = ['"]([^'"]+)['"]/i)?.[1];
assert.ok(appVersion && cacheVersion, 'App/cache version constants could not be read.');
assert.equal(appVersion, cacheVersion, 'APP_VERSION and CACHE_VERSION must stay in sync.');

for (const optionalVendor of ['chart.umd.min.js', 'qrcode-generator.js', 'zxing-browser.min.js']) {
  assert.doesNotMatch(index, new RegExp(`<script[^>]+${optionalVendor.replaceAll('.', '\\.')}`), `${optionalVendor} must stay out of the startup path.`);
}

console.log(`Asset graph is complete, offline-safe, duplicate-free, and versioned as ${appVersion}.`);
