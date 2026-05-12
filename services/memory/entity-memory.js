const { getSizeByFootLength } = require('../../knowledge-base');

function extractAdultSize(raw = '') {
  return String(raw || '').match(/(?:у\s+меня|мне|для\s+меня|себя)\D{0,20}\b(2[0-9]|3[0-9]|4[0-9]|5[0-2])\b/i)?.[1] || null;
}

function extractChildFootLength(raw = '') {
  return String(raw || '').match(/(?:реб[её]н\w*|дет\w*)\D{0,20}(\d{2}(?:[.,]\d)?)\s*(?:см|cm)/i)?.[1]?.replace(',', '.') || null;
}

function childSizeByFootLength(cm) {
  if (!cm) return null;
  const value = Number(String(cm).replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return getSizeByFootLength(value, value >= 20.5 ? 'LittleLightTeen' : 'LittleLightKids')?.size || null;
}

function extractEntities(parsed = {}) {
  const adultSize = extractAdultSize(parsed.raw);
  const childFootLength = extractChildFootLength(parsed.raw);
  const childRecommendedSize = childSizeByFootLength(childFootLength);
  return {
    preferredSize: adultSize || parsed.size || parsed.recommendedSize || null,
    adultSize,
    preferredBrand: parsed.brand || null,
    preferredColor: parsed.colorHuman || parsed.color || null,
    preferredMaterial: parsed.material || null,
    footLength: parsed.footLength || null,
    childFootLength: childFootLength ? Number(childFootLength) : null,
    childRecommendedSize,
    childAge: parsed.childAge || null,
    customerType: parsed.customerType || null,
    lastIntent: parsed.intent || null,
  };
}

function mergeEntities(previous = {}, next = {}) {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(next || {})) {
    if (value !== undefined && value !== null && value !== '') merged[key] = value;
  }
  return merged;
}

module.exports = {
  extractEntities,
  mergeEntities,
};
