function normalizeList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function buildRecommendationSnapshot(responsePlan = {}) {
  const brands = normalizeList(responsePlan.suggestedBrands || []);
  const useCases = normalizeList(responsePlan.suggestedUseCases || []);
  if (!brands.length && !useCases.length && !responsePlan.shouldRecommend) return null;
  return {
    mode: responsePlan.mode || '',
    intent: responsePlan.intent || responsePlan.selectedIntent || '',
    activeProfile: responsePlan.activeProfile || '',
    brands,
    useCases,
    reason: responsePlan.orchestrationReason || '',
    createdAt: new Date().toISOString(),
  };
}

function hasRecentRecommendation(state = {}) {
  const last = state.lastRecommendation || null;
  if (!last) return false;
  return Boolean(
    (Array.isArray(last.brands) && last.brands.length)
    || (Array.isArray(last.useCases) && last.useCases.length)
  );
}

function applyRecommendationProgression(state = {}, responsePlan = {}) {
  const snapshot = buildRecommendationSnapshot(responsePlan);
  if (!snapshot) return state;
  const history = Array.isArray(state.recommendationHistory) ? state.recommendationHistory : [];
  state.lastRecommendation = snapshot;
  state.recommendationHistory = [snapshot, ...history].slice(0, 5);
  return state;
}

module.exports = {
  applyRecommendationProgression,
  buildRecommendationSnapshot,
  hasRecentRecommendation,
};
