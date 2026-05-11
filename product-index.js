const { BRAND_LINES, COLORS, MATERIALS, BRANDS } = require('./knowledge-base');
const { normalizeText, parseBillzProduct, humanizeBillzProduct } = require('./product-parser');

const BANNED_MODEL_WORDS = new Set([
  'размер', 'размера', 'размером', 'размеры',
  'цвет', 'цвета', 'цветом',
  'обувь', 'обуви', 'обувью',
  'бренд', 'бренды', 'марка', 'марки',
  'модель', 'модели',
  'наличие', 'есть',
  'цена', 'цены', 'стоимость',
  'какие', 'какой', 'какая', 'вас', 'помимо', 'кроме',
].map(normalizeText));

function normalizeSearchText(text) {
  let value = normalizeText(text);
  const replacements = [
    [/\bчерн\w*/g, 'черный'],
    [/\bblack\b/g, 'черный'],
    [/\bбел\w*/g, 'белый'],
    [/\bwhite\b/g, 'белый'],
    [/\bбеж\w*/g, 'бежевый'],
    [/\bbeige\b/g, 'бежевый'],
    [/\bзамш\w*/g, 'замша'],
    [/\bsuede\b/g, 'замша'],
    [/\bкож\w*/g, 'кожа'],
    [/\bleather\b/g, 'кожа'],
    [/\bразмер\w*/g, 'размер'],
    [/\bбренд\w*/g, 'бренд'],
    [/\bмодел\w*/g, 'модель'],
  ];
  replacements.forEach(([pattern, replacement]) => {
    value = value.replace(pattern, replacement);
  });
  return value.replace(/\s+/g, ' ').trim();
}

function expandColorTerms(color) {
  if (!color?.code && !color?.name) return [];
  const terms = [color.code, color.name, color.display];
  if (color.code === 'BK') terms.push('black', 'черная', 'черные');
  if (color.code === 'WH') terms.push('white', 'белая', 'белые');
  if (color.code === 'BE') terms.push('beige', 'бежевая', 'бежевые');
  return terms.filter(Boolean);
}

function expandMaterialTerms(material) {
  if (!material?.code && !material?.name) return [];
  const terms = [material.code, material.name];
  if (material.code === '02') terms.push('suede', 'замшевые');
  if (material.code === '01') terms.push('leather', 'кожаные');
  return terms.filter(Boolean);
}

function buildProductDoc(product, index = 0) {
  const parsed = parseBillzProduct(product);
  const human = humanizeBillzProduct(product);
  const rawParts = [
    product.id,
    product.name,
    product.sku,
    product.vendorCode,
    product.barcode,
    parsed.brand?.name,
    parsed.brand?.code,
    parsed.model,
    ...expandColorTerms(parsed.color),
    ...expandMaterialTerms(parsed.material),
    parsed.size,
    parsed.store?.name,
    parsed.store?.code,
    human.title,
    human.description,
  ].filter(Boolean);
  const searchableText = normalizeSearchText(rawParts.join(' '));
  const tokens = Array.from(new Set(searchableText.split(' ').filter(Boolean)));
  return {
    id: product.id || product.sku || product.barcode || `${index}`,
    raw: product,
    normalized: parsed,
    human,
    tokens,
    brand: parsed.brand?.name || null,
    brandLine: parsed.brand?.line || BRAND_LINES[parsed.brand?.name] || null,
    model: parsed.model || null,
    colorCode: parsed.color?.code || null,
    colorHuman: parsed.color?.name || null,
    materialCode: parsed.material?.code || null,
    materialHuman: parsed.material?.name || null,
    size: parsed.size || null,
    price: Number(product.price || 0) || null,
    stock: Number(product.stock ?? product.qty ?? product.availableQty ?? 0),
    store: parsed.store && !parsed.store.lowConfidence ? parsed.store.name : null,
    humanName: human.title,
    searchableText,
  };
}

function buildProductIndex(products = []) {
  const docs = (Array.isArray(products) ? products : []).map(buildProductDoc);
  const brands = Array.from(new Set(docs.map((doc) => doc.brand).filter(Boolean)));
  const models = Array.from(new Set(docs.map((doc) => doc.model).filter(Boolean)));
  return { docs, brands, models, total: docs.length };
}

function isBannedModelWord(word) {
  const normalized = normalizeSearchText(word);
  return !normalized || BANNED_MODEL_WORDS.has(normalized) || normalized.startsWith('обув') || normalized.startsWith('размер') || normalized.startsWith('цвет') || normalized.startsWith('бренд') || normalized.startsWith('модел');
}

function resolveModelFromIndex(parsedQuery, index) {
  const candidate = normalizeSearchText(parsedQuery.model || '');
  if (!candidate || isBannedModelWord(candidate)) return { model: null, confidence: 0 };
  const match = index.models.find((model) => normalizeSearchText(model).includes(candidate));
  return match ? { model: match, confidence: 0.9 } : { model: null, confidence: 0 };
}

function tokenScore(doc, normalizedQuery) {
  const queryTokens = normalizedQuery.split(' ').filter((token) => token.length >= 3 && !isBannedModelWord(token));
  return queryTokens.reduce((score, token) => score + (doc.searchableText.includes(token) ? 5 : 0), 0);
}

function scoreProduct(doc, parsedQuery, normalizedQuery, options = {}) {
  if (doc.stock <= 0) return 0;
  if (parsedQuery.size && doc.size !== String(parsedQuery.size)) return 0;
  if (parsedQuery.customerType === 'kids' && doc.brandLine === 'adult' && !parsedQuery.brand) return 0;
  if (parsedQuery.brand && normalizeText(doc.brand) !== normalizeText(parsedQuery.brand)) return 0;

  let score = 20;
  const colorCodes = parsedQuery.colorCodes?.length ? parsedQuery.colorCodes : (parsedQuery.colorCode ? [parsedQuery.colorCode] : []);
  if (colorCodes.length && colorCodes.includes(doc.colorCode)) score += 30;
  if (colorCodes.length && !colorCodes.includes(doc.colorCode)) score -= options.soft ? 0 : 12;

  if (parsedQuery.materialCode && parsedQuery.materialCode === doc.materialCode) score += 25;
  if (parsedQuery.materialCode && parsedQuery.materialCode !== doc.materialCode && !options.soft) score -= 10;

  if (parsedQuery.brand && normalizeText(doc.brand) === normalizeText(parsedQuery.brand)) score += 25;
  if (parsedQuery.excludeBrand && normalizeText(doc.brand) === normalizeText(parsedQuery.excludeBrand)) return 0;

  if (parsedQuery.sku && normalizeText(doc.raw.sku || doc.raw.vendorCode) === normalizeText(parsedQuery.sku)) score += 100;
  if (parsedQuery.barcode && String(doc.raw.barcode || '') === String(parsedQuery.barcode)) score += 100;

  if (options.model && normalizeSearchText(doc.model).includes(normalizeSearchText(options.model))) score += 35;
  score += tokenScore(doc, normalizedQuery);
  return Math.max(0, score);
}

function searchProductIndex(index, parsedQuery, query, limit = 5) {
  const normalizedQuery = normalizeSearchText(query || parsedQuery.raw || '');
  const modelMatch = resolveModelFromIndex(parsedQuery, index);
  const rank = (soft = false) => index.docs
    .map((doc) => ({ doc, score: scoreProduct(doc, parsedQuery, normalizedQuery, { soft, model: modelMatch.model }) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const strictRanked = rank(false);
  const softRanked = strictRanked.length ? strictRanked : rank(true);
  const finalRanked = softRanked;
  return {
    normalizedQuery,
    modelConfidence: modelMatch.confidence,
    resolvedModel: modelMatch.model,
    strictMatches: strictRanked.length,
    softMatches: softRanked.length,
    finalMatches: finalRanked.length,
    topScores: finalRanked.slice(0, 5).map((item) => ({ name: item.doc.raw.name, score: item.score })),
    products: finalRanked.slice(0, Math.max(1, Number(limit) || 5)).map((item) => item.doc.raw),
    docs: finalRanked.slice(0, Math.max(1, Number(limit) || 5)).map((item) => item.doc),
  };
}

function buildBrandSummary(index) {
  const known = ['TipsieToes', 'Little Light', 'Saguaro'];
  return {
    brandsAvailable: Array.from(new Set([...index.brands, ...known])).filter(Boolean),
    unavailableKnownBrands: ['Be Lenka'],
  };
}

module.exports = {
  normalizeSearchText,
  buildProductDoc,
  buildProductIndex,
  searchProductIndex,
  buildBrandSummary,
  isBannedModelWord,
};
