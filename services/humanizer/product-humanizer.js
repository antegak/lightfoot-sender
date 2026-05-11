const { COLORS, MATERIALS } = require('../../knowledge-base');

function formatPrice(value) {
  const price = Number(value || 0);
  if (!Number.isFinite(price) || price <= 0) return '';
  return `${Math.round(price)} сом`;
}

function normalizeHumanColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (upper.includes('&')) {
    const mixedNames = {
      BK: 'черным',
      WH: 'белым',
      BE: 'бежевым',
      GR: 'зеленым',
      GY: 'серым',
      PI: 'розовым',
      WR: 'бордовым',
    };
    const firstNames = {
      BK: 'черные',
      WH: 'белые',
      BE: 'бежевые',
      GR: 'зеленые',
      GY: 'серые',
      PI: 'розовые',
      WR: 'бордовые',
    };
    const [first, ...rest] = upper.split('&');
    const firstName = firstNames[first] || COLORS[first] || first;
    const restName = rest.map((code) => mixedNames[code] || COLORS[code] || code).join(' и ');
    return restName ? `${firstName} с ${restName}` : firstName;
  }
  return COLORS[upper] || raw;
}

function normalizeMaterial(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return MATERIALS[raw] || raw;
}

function cleanModelName(value) {
  return String(value || '')
    .replace(/\b[A-Z]{2,}\d{2,}[A-Z0-9-]*\b/g, '')
    .replace(/\b(BK|WH|BE|GR|LG|PI|WR|LR|GY|BL|BR|RD|RO|SB|TI|PU|LA|YE|DG|KH|BG|DB|NV|GD|OR)\b/g, '')
    .replace(/\b(01|02|03|04)\b/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizeProduct(product = {}) {
  const parsed = product.parsed || {};
  const brand = product.brand || parsed.brand?.name || '';
  const model = product.model || parsed.model || cleanModelName(product.name || product.title || '');
  const color = normalizeHumanColor(product.displayColor || product.color || parsed.color?.mixedCode || parsed.color?.display || parsed.color?.name || parsed.color?.code);
  const material = normalizeMaterial(product.material || parsed.material?.name || parsed.material?.code);
  const size = product.size || parsed.size || '';
  const price = formatPrice(product.price);

  const title = [brand, model].filter(Boolean).join(' ').trim() || model || color || 'модель';
  const details = [color, material, size ? `${size} размер` : '', price].filter(Boolean).join(' — ');
  return details ? `${title} — ${details}` : title;
}

function humanizeProducts(products = [], limit = 3) {
  return (Array.isArray(products) ? products : [])
    .slice(0, Math.max(1, Number(limit) || 3))
    .map((product) => `• ${humanizeProduct(product)}`)
    .join('\n');
}

module.exports = {
  formatPrice,
  normalizeHumanColor,
  normalizeMaterial,
  humanizeProduct,
  humanizeProducts,
};
