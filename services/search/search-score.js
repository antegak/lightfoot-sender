const { normalizeText } = require('./query-normalizer');

function same(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function strictScore(doc, query) {
  if (!doc) return 0;
  if (query.sku && !same(doc.raw?.sku || doc.raw?.vendorCode, query.sku)) return 0;
  if (query.barcode && String(doc.raw?.barcode || '') !== String(query.barcode)) return 0;
  if (query.size && String(doc.size || '') !== String(query.size)) return 0;
  if (!query.size && query.recommendedSize && String(doc.size || '') !== String(query.recommendedSize)) return 0;
  if (query.brand && !same(doc.brand, query.brand)) return 0;
  const docColorCodes = Array.isArray(doc.colorCodes) && doc.colorCodes.length ? doc.colorCodes : (doc.colorCode ? [doc.colorCode] : []);
  if (query.colorCodes?.length > 1 && !query.colorCodes.every((code) => docColorCodes.includes(code))) return 0;
  if (query.colorCodes?.length === 1 && !docColorCodes.includes(query.colorCodes[0])) return 0;
  if (query.materialCode && query.materialCode !== doc.materialCode) return 0;
  let score = 100;
  if (query.size) score += 25;
  if (query.brand) score += 20;
  if (query.colorCodes?.length) score += 15;
  if (query.materialCode) score += 15;
  return score;
}

function enrichScore(doc, query, baseScore = 0) {
  let score = Number(baseScore) || 0;
  if (query.size && String(doc.size || '') === String(query.size)) score += 25;
  if (query.recommendedSize && String(doc.size || '') === String(query.recommendedSize)) score += 18;
  if (query.brand && same(doc.brand, query.brand)) score += 20;
  const docColorCodes = Array.isArray(doc.colorCodes) && doc.colorCodes.length ? doc.colorCodes : (doc.colorCode ? [doc.colorCode] : []);
  if (query.colorCodes?.length > 1 && query.colorCodes.every((code) => docColorCodes.includes(code))) score += 24;
  else if (query.colorCodes?.length === 1 && docColorCodes.includes(query.colorCodes[0])) score += 18;
  if (query.materialCode && query.materialCode === doc.materialCode) score += 14;
  if (query.customerType === 'kids' && doc.brandLine === 'adult' && !query.brand) score -= 25;
  if (query.customerType === 'adult' && doc.brandLine === 'kids' && !query.brand) score -= 15;
  if (Number(doc.stock) <= 0) score -= 60;
  return Math.max(0, score);
}

function buildReason(doc, query, mode, score) {
  const reasons = [mode];
  if (query.brand && same(doc.brand, query.brand)) reasons.push('brand');
  if (query.size && String(doc.size || '') === String(query.size)) reasons.push('size');
  if (query.recommendedSize && String(doc.size || '') === String(query.recommendedSize)) reasons.push('recommended-size');
  const docColorCodes = Array.isArray(doc.colorCodes) && doc.colorCodes.length ? doc.colorCodes : (doc.colorCode ? [doc.colorCode] : []);
  if (query.colorCodes?.length && query.colorCodes.some((code) => docColorCodes.includes(code))) reasons.push('color');
  if (query.materialCode && query.materialCode === doc.materialCode) reasons.push('material');
  return { reasons, score };
}

module.exports = {
  strictScore,
  enrichScore,
  buildReason,
};
