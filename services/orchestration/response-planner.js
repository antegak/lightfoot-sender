const { computeRecommendationConfidence, determineClarification } = require('./clarification-engine');
const { buildAllowedTopics, buildForbiddenTopics, getActiveProfile } = require('./context-priority');
const { detectPriorityIntent } = require('./intent-hierarchy');
const { selectMode } = require('./mode-selector');
const { buildRecommendations } = require('./recommendation-engine');
const { buildSafetyFlags, determineRisk } = require('./safety-engine');

function inferEmotion(selectedIntent, query = '') {
  if (['nail_problem', 'pain_problem', 'comfort_problem', 'toe_pain', 'wide_foot'].includes(selectedIntent)) return 'pain';
  if (/не знаю|сомне|РЅРµ\s+Р·РЅР°СЋ|СЃРѕРјРЅРµ/i.test(String(query))) return 'uncertain';
  if (/есть|цена|РµСЃС‚СЊ|С†РµРЅР°/i.test(String(query))) return 'ready_to_buy';
  if (selectedIntent === 'style_guidance' || selectedIntent === 'comparison') return 'interested';
  return 'exploring';
}

function inferEnergy(mode, emotion) {
  if (mode === 'comfort_consultation' || emotion === 'pain') return 'low';
  if (mode === 'recommendation' || mode === 'style_guidance') return 'high';
  return 'medium';
}

function inferMomentum(conversationState = {}) {
  if (conversationState.currentStage === 'conversion') return 'closing_stage';
  if (['recommendation', 'comparison', 'narrowing'].includes(conversationState.currentStage)) return 'mid_stage';
  return 'early_stage';
}

function selectVariation(mode, suggestedUseCases = []) {
  if (mode === 'sport_selection' || suggestedUseCases.length > 1) return 'two_paths';
  if (mode === 'comfort_consultation') return 'soft';
  if (mode === 'availability_check') return 'direct';
  return 'consultant_note';
}

function hasRecommendationCommitment({ mode, activeProfile, profile = {}, parsedQuery = {} } = {}) {
  if (mode !== 'availability_check') return false;
  if (!['adultProfile', 'childProfile', 'teenProfile'].includes(activeProfile)) return false;
  const hasBrand = Boolean(profile.preferredBrand || parsedQuery.brand);
  const hasFitContext = Boolean(profile.size || profile.footLengthCm || profile.useCase || profile.fitPreference || profile.stylePreference);
  return hasBrand && hasFitContext;
}

function buildResponsePlan({
  query = '',
  parsedQuery = {},
  conversationState = {},
  searchResults = {},
  billzConnected = true,
} = {}) {
  const hierarchy = detectPriorityIntent(query, parsedQuery, conversationState);
  const { key: activeProfile, profile } = getActiveProfile(conversationState);
  const searchAllowed = hierarchy.selectedIntent === 'exact_availability'
    || hierarchy.selectedIntent === 'product_gallery'
    || Boolean(conversationState.shouldSearchProducts && !['nail_problem', 'pain_problem', 'comfort_problem', 'wide_foot', 'child_school_selection', 'family_selection'].includes(hierarchy.selectedIntent));
  const risk = determineRisk({ selectedIntent: hierarchy.selectedIntent, searchAllowed, billzConnected });
  const recommendationConfidence = computeRecommendationConfidence({ selectedIntent: hierarchy.selectedIntent, conversationState, activeProfileKey: activeProfile, parsedQuery });
  const clarification = determineClarification({ selectedIntent: hierarchy.selectedIntent, recommendationConfidence, conversationState, riskLevel: risk.riskLevel });
  const rec = buildRecommendations({ selectedIntent: hierarchy.selectedIntent, activeProfileKey: activeProfile, conversationState });
  const mode = selectMode({ selectedIntent: hierarchy.selectedIntent, conversationState, searchAllowed });
  const customerEmotion = inferEmotion(hierarchy.selectedIntent, query);
  const conversationEnergy = inferEnergy(mode, customerEmotion);
  const suggestedUseCases = rec.suggestedUseCases || [];
  const committedRecommendation = hasRecommendationCommitment({ mode, activeProfile, profile, parsedQuery });
  const shouldRecommend = mode === 'product_gallery'
    ? false
    : (mode === 'availability_check'
      ? committedRecommendation
      : (rec.shouldRecommend || recommendationConfidence >= 70));
  return {
    mode,
    intent: hierarchy.selectedIntent,
    selectedMode: mode,
    selectedIntent: hierarchy.selectedIntent,
    responseStrategy: mode,
    galleryIntent: mode === 'product_gallery',
    shouldSearchProducts: searchAllowed,
    searchAllowed,
    shouldClarify: clarification.shouldClarify,
    clarificationAllowed: clarification.clarificationAllowed,
    shouldRecommend,
    shouldEmpathize: mode === 'comfort_consultation',
    empathyGate: {
      shouldEmpathize: mode === 'comfort_consultation',
      intensity: mode === 'comfort_consultation' ? 'warm' : 'none',
    },
    recommendationConfidence,
    activeProfile,
    activeProfileData: profile,
    currentFocus: conversationState.currentFocus || null,
    allowedTopics: buildAllowedTopics(activeProfile, hierarchy.selectedIntent),
    forbiddenTopics: buildForbiddenTopics(hierarchy.selectedIntent, searchAllowed),
    suggestedBrands: rec.suggestedBrands || [],
    suggestedUseCases,
    searchHint: rec.searchHint || '',
    previousIntent: conversationState.previousIntent || null,
    lastHealthIntent: conversationState.lastHealthIntent || null,
    responseTone: mode === 'comfort_consultation' ? 'calm_supportive' : 'calm_premium_consultant',
    maxQuestionsAllowed: clarification.shouldClarify ? 1 : (mode === 'availability_check' ? 0 : 1),
    riskLevel: risk.riskLevel,
    safetyFlags: buildSafetyFlags({ selectedIntent: hierarchy.selectedIntent, searchAllowed }),
    conversationEnergy,
    customerEmotion,
    conversationMomentum: inferMomentum(conversationState),
    trustBuildingMode: mode === 'comfort_consultation',
    variationStyle: selectVariation(mode, suggestedUseCases),
    salesPushLimit: {
      recentRecommendationCount: 0,
      shouldSoften: mode === 'comfort_consultation',
    },
    memoryDecay: {
      focusAge: 0,
      oldFocusPriority: 1,
    },
    orchestrationReason: `${hierarchy.reason}; ${clarification.reason}; ${risk.reason}`,
    intentCandidates: hierarchy.candidates,
  };
}

module.exports = {
  buildResponsePlan,
};
