const { BRAND_LINES, BRANDS, COLORS, MATERIALS, STORES, formatStoreAddress } = require('./knowledge-base');

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s./_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function colorToPlural(color) {
  const forms = {
    'черный': 'черные',
    'белый': 'белые',
    'бежевый': 'бежевые',
    'коричневый': 'коричневые',
    'зеленый': 'зеленые',
    'светло-зеленый': 'светло-зеленые',
    'светло-серый': 'светло-серые',
    'серый': 'серые',
    'синий': 'синие',
    'темно-синий': 'темно-синие',
    'бордовый': 'бордовые',
    'розовый': 'розовые',
    'красный': 'красные',
    'ярко-розовый': 'ярко-розовые',
    'небесно-голубой': 'небесно-голубые',
    'тиффани': 'тиффани',
    'фиолетовый': 'фиолетовые',
    'фиалка': 'фиалковые',
    'желтый': 'желтые',
    'темно-серый': 'темно-серые',
    'хаки': 'хаки',
    'темно-зеленый': 'темно-зеленые',
    'золото': 'золотые',
    'оранжевый': 'оранжевые',
  };
  return forms[color] || color || null;
}

function normalizeColorCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return COLORS[code] ? code : '';
}

function detectBrand(product = {}) {
  const text = `${product.name || ''} ${product.sku || ''} ${product.vendorCode || ''}`;
  const lower = normalizeText(text);
  if (/\bBB\b/i.test(text)) return { code: 'BB', name: 'Be Lenka', line: BRAND_LINES['Be Lenka'] };
  if (/\bKT\b/i.test(text) || lower.includes('key top') || lower.includes('keytop')) return { code: 'KT', name: 'Key Top', line: BRAND_LINES['Key Top'] };
  if (/\bXZ\b/i.test(text) || lower.includes('xzero') || lower.includes('x zero')) return { code: 'XZ', name: 'XZero', line: BRAND_LINES.XZero };
  if (/(be\s*lenka|belenka|бе\s*ленка|беленка)/i.test(text) || lower.includes('be lenka') || lower.includes('belenka')) return { code: 'BELENKA', name: 'Be Lenka', line: BRAND_LINES['Be Lenka'] };
  if (/\bLL\b/i.test(text) || lower.includes('little light') || lower.includes('детская линия')) return { code: 'LL', name: 'Little Light', line: BRAND_LINES['Little Light'] };
  if (lower.includes('saguaro') || lower.includes('сагуаро')) return { code: 'SAGUARO', name: 'Saguaro', line: BRAND_LINES.Saguaro };
  const prefix = String(text).match(/\b([A-Z]{2})\b/)?.[1];
  if (prefix && BRANDS[prefix]) return { code: prefix, name: BRANDS[prefix], line: BRAND_LINES[BRANDS[prefix]] || null };
  if (lower.includes('tipsietoes')) return { code: 'TT', name: BRANDS.TT, line: BRAND_LINES[BRANDS.TT] };
  return null;
}

function detectSku(product = {}) {
  const text = `${product.sku || ''} ${product.vendorCode || ''} ${product.name || ''}`;
  return text.match(/\b[A-Z]{2,}\d{3,}[A-Z0-9-]*\b/i)?.[0] || product.sku || product.vendorCode || null;
}

function detectColor(product = {}) {
  const candidates = [
    product.color,
    product.sku,
    product.vendorCode,
    product.name,
    product.model,
    ...String(product.name || '').split('/'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const mixed = String(candidate || '').toUpperCase().match(/\b([A-Z]{2}(?:\s*&\s*[A-Z]{2})+)\b/)?.[1]?.replace(/\s+/g, '');
    if (mixed) {
      const parts = mixed.split('&').map(normalizeColorCode).filter(Boolean);
      if (parts.length >= 2) {
        return {
          code: parts[0],
          codes: parts,
          mixedCode: mixed,
          name: parts.map((code) => COLORS[code]).filter(Boolean).join(' + '),
          display: parts.map((code) => colorToPlural(COLORS[code]) || COLORS[code]).filter(Boolean).join(' + '),
        };
      }
    }
    const direct = normalizeColorCode(candidate);
    if (direct) return { code: direct, name: COLORS[direct], display: colorToPlural(COLORS[direct]) };
    const upper = String(candidate || '').toUpperCase();
    const suffixCode = Object.keys(COLORS)
      .sort((a, b) => b.length - a.length)
      .find((code) => upper.endsWith(code) || upper.includes(`${code} /`) || upper.includes(`${code}-`));
    if (suffixCode) return { code: suffixCode, name: COLORS[suffixCode], display: colorToPlural(COLORS[suffixCode]) };
    const tokens = String(candidate).match(/\b[A-Z]{2}\b/g) || [];
    for (const token of tokens.reverse()) {
      const code = normalizeColorCode(token);
      if (code) return { code, name: COLORS[code], display: colorToPlural(COLORS[code]) };
    }
  }

  const text = normalizeText(candidates.join(' '));
  const found = Object.values(COLORS).find((color) => text.includes(normalizeText(color)));
  return found ? { code: null, name: found, display: colorToPlural(found) } : null;
}

function detectMaterial(product = {}) {
  const candidates = [product.material, product.name, product.model, product.sku].filter(Boolean);
  for (const candidate of candidates) {
    const tokens = String(candidate).match(/\b\d{2}\b/g) || [];
    for (const token of tokens) {
      if (MATERIALS[token]) return { code: token, name: MATERIALS[token] };
    }
  }
  const text = normalizeText(candidates.join(' '));
  if (text.includes('замш')) return { code: null, name: 'замша' };
  if (text.includes('кожа')) return { code: null, name: 'кожа' };
  if (text.includes('текстил')) return { code: null, name: 'текстиль' };
  return null;
}

function detectSize(product = {}) {
  const values = [product.size, product.name, product.model, product.sku].filter(Boolean);
  for (const value of values) {
    const explicit = String(value).match(/(?:\/|\s)\s*(2[0-9]|3[0-9]|4[0-9]|5[0-2])(?:\s|$)/);
    if (explicit) return explicit[1];
  }
  return null;
}

function detectModel(product = {}) {
  const brand = detectBrand(product);
  const name = String(product.name || product.model || '').split('/')[0].trim();
  if (!name) return null;
  let cleaned = name
    .replace(/\bTT\b/g, '')
    .replace(/\b[A-Z]{2,}\d{3,}[A-Z0-9-]*\b/gi, '')
    .replace(/\b(01|02|03|04)\b/g, '')
    .replace(new RegExp(`\\b(${Object.keys(COLORS).join('|')})\\b`, 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim();
  if (brand?.name === 'Saguaro') cleaned = cleaned || name;
  return cleaned || null;
}

function findStoreInText(value) {
  const text = normalizeText(value);
  if (!text) return null;
  for (const [code, store] of Object.entries(STORES)) {
    const exactCode = normalizeText(code);
    if (text === exactCode || text.includes(` ${exactCode} `)) {
      return { code, ...store, formatted: formatStoreAddress(store) };
    }
    if ((store.patterns || []).some((pattern) => text.includes(normalizeText(pattern)))) {
      return { code, ...store, formatted: formatStoreAddress(store) };
    }
  }
  return null;
}

function detectStore(product = {}) {
  const candidates = [];
  const pushStoreCandidate = (value, source, inStock = true) => {
    if (value !== undefined && value !== null && inStock) candidates.push({ value, source });
  };

  for (const shop of Array.isArray(product.shops) ? product.shops : []) {
    pushStoreCandidate(shop.shopName || shop.shop_name || shop.name || shop.store_name || shop.warehouse_name || shop.shopId || shop.shop_id, 'shops', Number(shop.stock ?? shop.active_measurement_value ?? 1) > 0);
  }
  for (const stock of Array.isArray(product.shop_measurement_values) ? product.shop_measurement_values : []) {
    pushStoreCandidate(stock.shop_name || stock.store_name || stock.warehouse_name || stock.shop_id, 'shop_measurement_values', Number(stock.active_measurement_value ?? stock.measurement_value ?? 0) > 0);
  }
  for (const price of Array.isArray(product.shop_prices) ? product.shop_prices : []) {
    pushStoreCandidate(price.shop_name || price.store_name || price.warehouse_name || price.shop_id, 'shop_prices');
  }

  pushStoreCandidate(product.store || product.store_name || product.warehouse || product.warehouse_name, 'store_fields');
  pushStoreCandidate(product.name, 'name');
  pushStoreCandidate(product.sku || product.vendorCode, 'sku');
  pushStoreCandidate(product.office || product.officeName || product.officeId, 'office_fallback');

  for (const candidate of candidates) {
    const store = findStoreInText(candidate.value);
    if (store && candidate.source !== 'office_fallback') return { ...store, source: candidate.source };
  }

  const fallback = candidates.find((candidate) => candidate.source === 'office_fallback');
  const fallbackStore = fallback ? findStoreInText(fallback.value) : null;
  return fallbackStore ? { ...fallbackStore, source: 'office_fallback', lowConfidence: true } : null;
}

function parseBillzProduct(product = {}) {
  const brand = detectBrand(product);
  const color = detectColor(product);
  const material = detectMaterial(product);
  const size = product.size ? String(product.size) : detectSize(product);
  const sku = detectSku(product);
  const model = product.model || detectModel(product);
  const store = detectStore(product);
  return {
    brand,
    color,
    material,
    size,
    sku,
    model,
    store,
  };
}

function humanizeBillzProduct(product = {}) {
  const parsed = parseBillzProduct(product);
  const title = [parsed.brand?.name, parsed.model].filter(Boolean).join(' ') || parsed.color?.display || 'модель';
  const details = [parsed.color?.display, parsed.material?.name].filter(Boolean).join(' ');
  return {
    title,
    description: details || null,
    size: parsed.size || null,
    price: Number(product.price || 0) || null,
    store: parsed.store && !parsed.store.lowConfidence ? {
      name: parsed.store.name,
      address: parsed.store.address,
      note: parsed.store.note,
      formatted: parsed.store.formatted,
    } : null,
    images: [],
    parsed,
  };
}

module.exports = {
  normalizeText,
  colorToPlural,
  normalizeColorCode,
  detectBrand,
  detectColor,
  detectMaterial,
  detectSize,
  detectStore,
  detectSku,
  detectModel,
  parseBillzProduct,
  humanizeBillzProduct,
};
