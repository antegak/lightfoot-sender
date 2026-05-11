function extractEntities(parsed = {}) {
  return {
    preferredSize: parsed.size || parsed.recommendedSize || null,
    preferredBrand: parsed.brand || null,
    preferredColor: parsed.colorHuman || parsed.color || null,
    preferredMaterial: parsed.material || null,
    footLength: parsed.footLength || null,
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
