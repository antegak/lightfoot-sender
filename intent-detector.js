const { COLORS, MATERIALS, BRANDS, getSizeByFootLength } = require('./knowledge-base');
const { normalizeText } = require('./product-parser');
const { normalizeQuery: normalizeAdvancedQuery } = require('./services/search/query-normalizer');

function detectIntent(message) {
  const text = normalizeText(message);
  if (/(какие|что за|какой).*(бренд|марки)|бренд.*(есть|прода)|марки.*есть/.test(text)) return 'brand_list';
  if (/(где|адрес|находит|примерить|филиал|магазин)/.test(text)) return 'location';
  if (/(стоп|см|сантиметр|размер лучше|какой размер|подойдет размер)/.test(text)) return 'sizing';
  if (/(цена|стоим|сколько|дешев|дороже)/.test(text)) return 'pricing';
  if (/(посовет|лучше|подбер|хочу|мягк|лето|зима|каждый день)/.test(text)) return 'recommendation';
  if (/(есть|налич|доступ|размер|черн|black|бел|white|беж|beige|замш|suede|кожа|saguaro|tipsie|tt|bk|wh|be|01|02|03|04)/.test(text)) return 'availability';
  return 'unknown';
}

function detectQueryColor(text) {
  return detectQueryColors(text)[0]?.human || null;
}

function detectQueryColors(text) {
  const normalized = normalizeText(text);
  const matches = [];
  const addColor = (code, human) => {
    if (!code || !human) return;
    if (!matches.some((item) => item.code === code)) matches.push({ code, human });
  };
  for (const [code, color] of Object.entries(COLORS)) {
    const upperText = String(text).toUpperCase();
    if (code === 'BE' && /\bBE\s+LENKA\b|\bBELENKA\b/.test(upperText)) continue;
    const codePattern = new RegExp(`(^|\\s)${code}($|\\s)`);
    if (normalized.includes(normalizeText(color)) || codePattern.test(upperText)) addColor(code, color);
  }
  const aliases = [
    ['черн', COLORS.BK],
    ['black', COLORS.BK],
    ['бел', COLORS.WH],
    ['white', COLORS.WH],
    ['беж', COLORS.BE],
    ['beige', COLORS.BE],
    ['бордов', COLORS.WR],
    ['роз', COLORS.PI],
    ['зелен', COLORS.GR],
    ['сер', COLORS.GY],
  ];
  for (const [alias, human] of aliases) {
    if (!normalized.includes(alias)) continue;
    const code = getColorCode(human);
    addColor(code, human);
  }
  return matches;
}

function getColorCode(colorHuman) {
  const wanted = normalizeText(colorHuman);
  if (!wanted) return null;
  return Object.entries(COLORS).find(([, value]) => normalizeText(value) === wanted)?.[0] || null;
}

function detectQueryMaterial(text) {
  const normalized = normalizeText(text);
  for (const material of Object.values(MATERIALS)) {
    if (normalized.includes(normalizeText(material))) return material;
  }
  if (normalized.includes('замш')) return 'замша';
  if (normalized.includes('suede')) return 'замша';
  if (normalized.includes('кож')) return 'кожа';
  if (normalized.includes('текстил')) return 'текстиль';
  if (/(^|\s)02($|\s)/.test(normalized)) return MATERIALS['02'];
  if (/(^|\s)01($|\s)/.test(normalized)) return MATERIALS['01'];
  if (/(^|\s)03($|\s)/.test(normalized)) return MATERIALS['03'];
  if (/(^|\s)04($|\s)/.test(normalized)) return MATERIALS['04'];
  return null;
}

function getMaterialCode(materialHuman) {
  const wanted = normalizeText(materialHuman);
  if (!wanted) return null;
  return Object.entries(MATERIALS).find(([, value]) => normalizeText(value) === wanted || normalizeText(value).includes(wanted))?.[0] || null;
}

function detectQueryBrand(text) {
  const normalized = normalizeText(text);
  if (/(be\s*lenka|belenka|бе\s*ленка|беленка)/i.test(String(text)) || normalized.includes('be lenka') || normalized.includes('belenka')) return 'Be Lenka';
  if (normalized.includes('little light') || normalized.includes('ll') || normalized.includes('детская линия')) return 'Little Light';
  if (normalized.includes('saguaro')) return 'Saguaro';
  for (const [code, brand] of Object.entries(BRANDS)) {
    if (normalized.includes(code.toLowerCase()) || normalized.includes(normalizeText(brand))) return brand;
  }
  return null;
}

function detectCustomerType(text) {
  const normalized = normalizeText(text);
  if (/(ребен|детск|подрост|мальчик|девоч|сын|дочь|3 года|4 года|5 лет|6 лет)/.test(normalized)) return 'kids';
  if (/(взросл|женск|мужск|для себя)/.test(normalized)) return 'adult';
  return null;
}

function detectExcludedBrand(text) {
  const normalized = normalizeText(text);
  if (!/(помимо|кроме|без|не)\s+/.test(normalized)) return null;
  if (normalized.includes('saguaro')) return 'Saguaro';
  for (const [code, brand] of Object.entries(BRANDS)) {
    if (normalized.includes(code.toLowerCase()) || normalized.includes(normalizeText(brand))) return brand;
  }
  return null;
}

function isGenericModelWord(word) {
  const normalized = normalizeText(word);
  if (!normalized) return true;
  const genericWords = new Set([
    'есть', 'какие', 'какой', 'какая', 'какое', 'размер', 'стопа', 'нога',
    'обувь', 'обуви', 'обувью', 'модель', 'модели', 'товар', 'товары',
    'черный', 'черная', 'черное', 'черные', 'black',
    'белый', 'белая', 'белое', 'белые',
    'бежевый', 'бежевые', 'бордовый', 'бордовые',
    'розовый', 'розовые', 'зеленый', 'зеленые', 'серый', 'серые',
    'замша', 'замшевые', 'замшевая', 'suede', 'кожа', 'кожаные', 'кожаная', 'текстиль',
  ].map(normalizeText));
  if (genericWords.has(normalized)) return true;
  if (normalized.startsWith('обув')) return true;
  if (normalized.startsWith('модел')) return true;
  if (normalized.startsWith('цвет')) return true;
  if (normalized.includes('tipsie') || normalized.includes('saguaro')) return true;
  if (['черн', 'бел', 'беж', 'бордов', 'роз', 'зелен', 'сер', 'красн', 'син', 'голуб', 'желт', 'оранж', 'корич'].some((stem) => normalized.startsWith(stem))) return true;
  if (['замш', 'кож', 'текстил'].some((stem) => normalized.startsWith(stem))) return true;
  if (normalized === 'помимо' || normalized === 'кроме' || normalized === 'вас') return true;
  if (normalized.length <= 3) return true;
  return false;
}

function parseCustomerQuery(message) {
  const raw = String(message || '').trim();
  const text = normalizeText(raw);
  const sku = raw.match(/\b[A-Z]{2,}\d{3,}[A-Z0-9-]*\b/i)?.[0] || raw.match(/\b[A-ZА-Я0-9]{2,}[-_/][A-ZА-Я0-9-_/]{2,}\b/i)?.[0] || null;
  const barcode = raw.match(/\b\d{8,14}\b/)?.[0] || null;
  const footLength = text.match(/(\d{2}(?:[.,]\d)?)\s*(?:см|cm)/)?.[1]?.replace(',', '.') || null;
  const size = footLength ? null : (text.match(/\b(?:размер\s*)?(2[0-9]|3[0-9]|4[0-9]|5[0-2])(?:\s*(?:размер|р|eu))?\b/)?.[1] || null);
  const colors = detectQueryColors(raw);
  const color = colors[0]?.human || null;
  const material = detectQueryMaterial(raw);
  const excludedBrand = detectExcludedBrand(raw);
  const brand = excludedBrand ? null : detectQueryBrand(raw);
  const customerType = detectCustomerType(raw);
  const colorCode = colors[0]?.code || getColorCode(color);
  const materialCode = getMaterialCode(material);
  const model = null;
  const advanced = normalizeAdvancedQuery(raw);
  return {
    raw,
    intent: advanced.intent || detectIntent(raw),
    size: size || advanced.size || advanced.recommendedSize || null,
    color: color || advanced.color || null,
    colorHuman: color || advanced.colorHuman || null,
    colorCode: colorCode || advanced.colorCode || null,
    colors: colors.length ? colors : advanced.colors,
    colorCodes: colors.length ? colors.map((item) => item.code) : advanced.colorCodes,
    mixedColorCodes: advanced.mixedColorCodes || [],
    material: material || advanced.material || null,
    materialCode: materialCode || advanced.materialCode || null,
    brand: brand || advanced.brand || null,
    brandCode: advanced.brandCode || null,
    excludeBrand: excludedBrand,
    customerType: customerType || advanced.customerType || null,
    genderCategory: advanced.genderCategory || null,
    sku,
    barcode,
    model,
    footLength: footLength ? Number(footLength) : advanced.footLength,
    childAge: advanced.childAge || null,
    recommendedSize: advanced.recommendedSize || null,
    sizeRecommendation: footLength ? getSizeByFootLength(footLength, advanced.customerType === 'kids' ? 'kids' : 'adult') : advanced.sizeRecommendation,
  };
}

module.exports = {
  detectIntent,
  parseCustomerQuery,
};
