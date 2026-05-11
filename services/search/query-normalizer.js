const fs = require('fs');
const path = require('path');
const { BRANDS, COLORS, MATERIALS, getSizeByFootLength } = require('../../knowledge-base');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'search-config.json'), 'utf8'));
  } catch {
    return { stopWords: [] };
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s.&/,+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COLOR_ALIASES = [
  { code: 'BK', terms: ['черн', 'black', 'bk'] },
  { code: 'WH', terms: ['бел', 'white', 'wh'] },
  { code: 'BE', terms: ['беж', 'beige'] },
  { code: 'GY', terms: ['сер', 'gray', 'grey', 'gy'] },
  { code: 'PI', terms: ['роз', 'pink', 'pi', 'pk'] },
  { code: 'WR', terms: ['бордов', 'винн', 'wine', 'wr'] },
  { code: 'GR', terms: ['зелен', 'green', 'gr'] },
  { code: 'LG', terms: ['светло зелен', 'светло-зелен', 'light green', 'lg'] },
];

const MATERIAL_ALIASES = [
  { code: '01', name: MATERIALS['01'], terms: ['кожа', 'кожан', 'leather', '01'] },
  { code: '02', name: MATERIALS['02'], terms: ['замш', 'suede', '02'] },
  { code: '03', name: MATERIALS['03'], terms: ['кожа замш', 'кожа/замш', '03'] },
  { code: '04', name: MATERIALS['04'], terms: ['текстиль', 'сетка', 'mesh', '04'] },
];

const BRAND_ALIASES = [
  { code: 'TT', name: 'TipsieToes', terms: ['tt', 'tipsietoes', 'tipsie toes', 'типси', 'типсито'] },
  { code: 'LL', name: 'Little Light', terms: ['ll', 'little light', 'литл', 'детская линия'] },
  { code: 'SAGUARO', name: 'Saguaro', terms: ['saguaro', 'сагуаро'] },
  { code: 'BB', name: 'Be Lenka', terms: ['bb', 'bl', 'be lenka', 'belenka', 'бе ленка', 'беленка'] },
  { code: 'KT', name: 'Key Top', terms: ['kt', 'key top', 'keytop', 'кей топ'] },
  { code: 'XZ', name: 'XZero', terms: ['xz', 'xzero', 'x zero', 'икс зеро'] },
];

function detectIntent(text) {
  if (/(какие|что).*бренд|бренд.*есть|марки.*есть/.test(text)) return 'brand_list';
  if (/(где|адрес|магазин|филиал|примерить)/.test(text)) return 'store_question';
  if (/(цена|стоим|сколько)/.test(text)) return 'price_question';
  if (/(см|сантиметр|стоп|какой размер|размер.*подойдет)/.test(text)) return 'sizing';
  if (/(посовет|подбери|лучше|рекоменд|что взять)/.test(text)) return 'recommendation';
  if (/(есть|налич|доступ|размер|цвет)/.test(text)) return 'availability';
  return 'availability';
}

function detectColors(text) {
  const colors = [];
  for (const item of COLOR_ALIASES) {
    if (item.terms.some((term) => {
      const normalizedTerm = normalizeText(term);
      if (normalizedTerm.length <= 2) return new RegExp(`(^|\\s)${normalizedTerm}($|\\s)`).test(text);
      return text.includes(normalizedTerm);
    })) {
      colors.push({ code: item.code, human: COLORS[item.code] || item.code });
    }
  }
  const mixedCodes = Array.from(new Set((String(text).toUpperCase().match(/\b[A-Z]{2}(?:\s*&\s*[A-Z]{2})+\b/g) || [])
    .map((value) => value.replace(/\s+/g, ''))));
  for (const mixed of mixedCodes) {
    const parts = mixed.split('&').filter((code) => COLORS[code]);
    if (parts.length >= 2) {
      for (const code of parts) colors.push({ code, human: COLORS[code], mixedCode: mixed });
    }
  }
  return Array.from(new Map(colors.filter((item) => item.code).map((item) => [item.code, item])).values());
}

function detectMaterial(text) {
  const found = MATERIAL_ALIASES.find((item) => item.terms.some((term) => text.includes(term)));
  return found ? { code: found.code, name: found.name } : null;
}

function detectBrand(text) {
  const found = BRAND_ALIASES.find((item) => item.terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (normalizedTerm.length <= 2) return new RegExp(`(^|\\s)${escaped}($|\\s)`).test(text);
    return text.includes(normalizedTerm);
  }));
  if (found) return { code: found.code, name: found.name };
  for (const [code, name] of Object.entries(BRANDS)) {
    const normalizedCode = code.toLowerCase();
    if (new RegExp(`(^|\\s)${normalizedCode}($|\\s)`).test(text) || text.includes(normalizeText(name))) return { code, name };
  }
  return null;
}

function detectAge(text) {
  const match = text.match(/\b(\d{1,2})\s*(?:года|год|лет)\b/);
  if (match) return Number(match[1]);
  if (text.includes('подрост')) return 'teen';
  if (text.includes('детск') || text.includes('ребен')) return 'kids';
  return null;
}

function detectCustomerType(text) {
  if (text.includes('подрост')) return 'teen';
  if (text.includes('детск') || text.includes('ребен') || /\b\d{1,2}\s*(?:года|год|лет)\b/.test(text)) return 'kids';
  if (text.includes('взросл') || text.includes('женск') || text.includes('мужск')) return 'adult';
  return null;
}

function removeStopWords(text) {
  const config = readConfig();
  const stopWords = new Set((config.stopWords || []).map(normalizeText));
  return text.split(' ').filter((token) => token && !stopWords.has(token)).join(' ');
}

function normalizeQuery(rawQuery, memory = {}) {
  const raw = String(rawQuery || '').trim();
  const text = normalizeText(raw);
  const colors = detectColors(text);
  const material = detectMaterial(text);
  const brand = detectBrand(text);
  const footLength = text.match(/(\d{2}(?:[.,]\d)?)\s*(?:см|cm|сантиметр)/)?.[1]?.replace(',', '.') || null;
  const explicitSize = footLength ? null : text.match(/\b(?:размер\s*)?(1[8-9]|2[0-9]|3[0-9]|4[0-9]|5[0-2])(?:\s*(?:размер|р|eu))?\b/)?.[1] || null;
  const customerType = detectCustomerType(text) || memory.customerType || null;
  const sizeTable = customerType === 'kids' ? 'kids' : 'adult';
  const sizeRecommendation = footLength ? getSizeByFootLength(footLength, sizeTable) : null;

  const merged = {
    raw,
    normalized: text,
    searchText: removeStopWords(text),
    intent: detectIntent(text),
    brand: brand?.name || memory.preferredBrand || null,
    brandCode: brand?.code || null,
    color: colors[0]?.human || memory.preferredColor || null,
    colorHuman: colors[0]?.human || memory.preferredColor || null,
    colorCode: colors[0]?.code || null,
    colorCodes: colors.map((item) => item.code),
    colors,
    mixedColorCodes: Array.from(new Set(colors.map((item) => item.mixedCode).filter(Boolean))),
    material: material?.name || memory.preferredMaterial || null,
    materialCode: material?.code || null,
    size: explicitSize || memory.preferredSize || null,
    footLength: footLength ? Number(footLength) : (memory.footLength || null),
    childAge: detectAge(text) || memory.childAge || null,
    customerType,
    genderCategory: text.includes('муж') ? 'men' : (text.includes('жен') || text.includes('девоч') ? 'women' : null),
    sizeRecommendation,
  };

  if (!merged.size && merged.sizeRecommendation?.size) merged.recommendedSize = merged.sizeRecommendation.size;
  return merged;
}

module.exports = {
  normalizeText,
  normalizeQuery,
  detectColors,
  detectBrand,
  detectMaterial,
  detectIntent,
  removeStopWords,
};
