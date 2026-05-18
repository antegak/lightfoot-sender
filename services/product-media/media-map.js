const fs = require('fs');
const path = require('path');

const MAP_PATH = path.join(__dirname, '..', '..', 'config', 'product-media.json');

function readMediaMap() {
  try {
    if (!fs.existsSync(MAP_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeKey(value = '') {
  return String(value || '').trim().toLocaleLowerCase('ru-RU');
}

function keysForProduct(product = {}) {
  const parsed = product.parsed || product.normalized || {};
  const brand = product.brand || parsed.brand?.name || product.normalizedProduct?.brand || '';
  const model = product.model || parsed.model || product.normalizedProduct?.model || '';
  const color = product.color || parsed.color?.code || product.normalizedProduct?.color?.code || '';
  return [
    product.sku,
    product.vendorCode,
    product.barcode,
    product.id,
    [brand, model, color].filter(Boolean).join('|'),
    [brand, model].filter(Boolean).join('|'),
  ].map(normalizeKey).filter(Boolean);
}

function findMappedMedia(product = {}, mediaMap = readMediaMap()) {
  const keys = keysForProduct(product);
  for (const key of keys) {
    const value = mediaMap[key] || mediaMap[key.toUpperCase?.()] || null;
    if (value) return value;
  }
  return null;
}

module.exports = {
  MAP_PATH,
  findMappedMedia,
  keysForProduct,
  readMediaMap,
};
