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
    .replace(/\b(BK|WH|BE|GR|LG|PI|WR|LR|GY|BR|RD|RO|SB|TI|PU|LA|YE|DG|KH|BG|DB|NV|GD|OR)\b/g, '')
    .replace(/\b(01|02|03|04)\b/g, '')
    .replace(/\b\d{1,2}\/\d{2}\b/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseChildAgeSize(product = {}) {
  const candidates = [
    product.size,
    product.model,
    product.name,
    product.title,
    product.parsed?.size,
  ].filter(Boolean).map(String);

  for (const candidate of candidates) {
    const match = candidate.match(/\b(\d{1,2})\/(\d{2})\b/);
    if (match) return { age: match[1], size: match[2], raw: match[0] };
  }
  return null;
}

function isLittleLightProduct(product = {}) {
  const raw = [
    product.brand,
    product.name,
    product.model,
    product.title,
    product.sku,
    product.parsed?.brand?.name,
    product.parsed?.brand?.code,
  ].filter(Boolean).join(' ').toLowerCase();
  return raw.includes('little light') || /\bll\b/i.test(raw);
}

function isBeLenkaChildProduct(product = {}) {
  const raw = [
    product.brand,
    product.name,
    product.model,
    product.title,
    product.sku,
    product.parsed?.brand?.name,
    product.parsed?.brand?.code,
  ].filter(Boolean).join(' ').toLowerCase();
  return raw.includes('be lenka') && /\bll\b/i.test(raw);
}

function getDisplayBrand(product = {}) {
  const brand = product.brand || product.parsed?.brand?.name || '';
  if (isBeLenkaChildProduct(product)) return 'Be Lenka';
  return brand;
}

function humanizeChildSize(product = {}) {
  const child = parseChildAgeSize(product);
  if (!child || !(isLittleLightProduct(product) || isBeLenkaChildProduct(product))) return null;
  return {
    raw: child.raw,
    ageText: `Примерно на ${child.age} года`,
    sizeText: `Размер ${child.size}`,
    age: child.age,
    size: child.size,
  };
}

function humanizeProduct(product = {}) {
  const normalized = product.normalizedProduct || (product.metadata && product.displayName ? product : null);
  if (normalized) {
    const brand = normalized.brand || '';
    const model = normalized.model || cleanModelName(normalized.displayName || '');
    const color = normalizeHumanColor(normalized.color?.label || normalized.color?.mixedCode || normalized.color?.code);
    const material = normalizeMaterial(normalized.material?.label || normalized.material?.code);
    const childSize = humanizeChildSize({
      brand,
      name: normalized.displayName,
      model,
      size: normalized.size,
      parsed: normalized.metadata?.parsed,
    });
    const size = childSize ? '' : (normalized.size || '');
    const price = formatPrice(normalized.price);
    const title = [brand, model].filter(Boolean).join(' ').trim() || normalized.displayName || 'модель';
    if (childSize) {
      return [
        `• ${[title, color].filter(Boolean).join(' — ')}`,
        `👣 ${childSize.ageText}`,
        `📏 ${childSize.sizeText}`,
        price ? `💰 ${price}` : '',
      ].filter(Boolean).join('\n');
    }
    const details = [color, material, size ? `${size} размер` : '', price].filter(Boolean).join(' — ');
    return `• ${details ? `${title} — ${details}` : title}`;
  }

  const parsed = product.parsed || {};
  const brand = getDisplayBrand(product);
  const model = product.model || parsed.model || cleanModelName(product.name || product.title || '');
  const color = normalizeHumanColor(product.displayColor || product.color || parsed.color?.mixedCode || parsed.color?.display || parsed.color?.name || parsed.color?.code);
  const material = normalizeMaterial(product.material || parsed.material?.name || parsed.material?.code);
  const childSize = humanizeChildSize(product);
  const size = childSize ? '' : (product.size || parsed.size || '');
  const price = formatPrice(product.price);

  const title = [brand, model].filter(Boolean).join(' ').trim() || model || color || 'модель';
  if (childSize) {
    return [
      `• ${[title, color].filter(Boolean).join(' — ')}`,
      `👣 ${childSize.ageText}`,
      `📏 ${childSize.sizeText}`,
      price ? `💰 ${price}` : '',
    ].filter(Boolean).join('\n');
  }

  const details = [color, material, size ? `${size} размер` : '', price].filter(Boolean).join(' — ');
  return `• ${details ? `${title} — ${details}` : title}`;
}

function humanizeProducts(products = [], limit = 3) {
  return (Array.isArray(products) ? products : [])
    .slice(0, Math.max(1, Number(limit) || 3))
    .map((product) => humanizeProduct(product))
    .join('\n');
}

module.exports = {
  formatPrice,
  normalizeHumanColor,
  normalizeMaterial,
  humanizeChildSize,
  humanizeProduct,
  humanizeProducts,
};
