function determineRisk({ selectedIntent, searchAllowed, billzConnected = true } = {}) {
  if (!billzConnected && searchAllowed) return { riskLevel: 'high', reason: 'billz_unavailable_for_exact_fact' };
  if (['nail_problem', 'pain_problem', 'health_concern', 'toe_pain', 'posture_problem'].includes(selectedIntent)) {
    return { riskLevel: 'medium', reason: 'comfort_health_language' };
  }
  if (selectedIntent === 'product_gallery') return { riskLevel: 'strict', reason: 'real_product_media_request' };
  if (searchAllowed) return { riskLevel: 'strict', reason: 'product_fact_request' };
  return { riskLevel: 'low', reason: 'directional_consultation' };
}

function buildSafetyFlags({ selectedIntent, searchAllowed } = {}) {
  return [
    'no_fake_availability',
    'no_fake_prices',
    'no_raw_sku_barcode_stock',
    ['nail_problem', 'pain_problem', 'health_concern', 'toe_pain', 'posture_problem'].includes(selectedIntent) ? 'no_medical_claims' : '',
    searchAllowed ? 'facts_from_billz_only' : 'no_product_dump',
    selectedIntent === 'product_gallery' ? 'real_product_photos_only' : '',
  ].filter(Boolean);
}

module.exports = {
  buildSafetyFlags,
  determineRisk,
};
