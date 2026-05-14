const freedomLevel = Object.freeze({
  LOW: 'strict_safe',
  MEDIUM: 'guided_consultant',
  HIGH: 'proactive_consultant',
});

function asksExactFact(text = '', parsed = {}) {
  return Boolean(
    /налич|есть|цена|сколько стоит|конкретн|модель|артикул|РЅР°Р»РёС‡|РµСЃС‚СЊ|С†РµРЅР°|СЃРєРѕР»СЊРєРѕ\s+СЃС‚РѕРёС‚|РјРѕРґРµР»/i.test(String(text || ''))
    || parsed.sku
    || parsed.barcode
  );
}

function canProgressConversation(state = {}) {
  return Boolean(
    state.currentFocus
    && state.currentFocus !== 'unknown'
    && state.nextBestAction !== 'ask_clarifying_question'
  );
}

function determineFreedom(state = {}, parsed = {}, searchResults = {}, options = {}) {
  const query = state.query || parsed.raw || '';
  const billzConnected = options.billzConnected !== false;
  const lowConfidence = Boolean(searchResults?.searchSummary?.lowConfidence || state.confidence < 45);
  const exactFact = asksExactFact(query, parsed);
  if (!billzConnected || exactFact || lowConfidence || state.conflictingData) {
    return {
      freedomLevel: freedomLevel.LOW,
      canBeInitiative: false,
      canRecommendDirection: false,
      shouldClarify: Boolean(lowConfidence || state.missingInfo?.length),
      canSkipSearch: false,
      canSuggestNextStep: true,
      reason: !billzConnected ? 'billz_unavailable' : (exactFact ? 'exact_fact_request' : (lowConfidence ? 'low_confidence' : 'strict_safety')),
    };
  }
  if (state.newInfo?.hasNewInfo || ['recommend_brand', 'compare_brands', 'recommend_direction'].includes(state.nextBestAction)) {
    return {
      freedomLevel: freedomLevel.MEDIUM,
      canBeInitiative: true,
      canRecommendDirection: true,
      shouldClarify: false,
      canSkipSearch: true,
      canSuggestNextStep: true,
      reason: state.newInfo?.hasNewInfo ? `new_${state.newInfo.newInfoType}` : 'advice_request',
    };
  }
  if (['discovery', 'recommendation', 'narrowing'].includes(state.currentStage) && canProgressConversation(state)) {
    return {
      freedomLevel: freedomLevel.HIGH,
      canBeInitiative: true,
      canRecommendDirection: true,
      shouldClarify: false,
      canSkipSearch: true,
      canSuggestNextStep: true,
      reason: 'progress_conversation',
    };
  }
  return {
    freedomLevel: freedomLevel.MEDIUM,
    canBeInitiative: true,
    canRecommendDirection: false,
    shouldClarify: Boolean(state.missingInfo?.length),
    canSkipSearch: true,
    canSuggestNextStep: true,
    reason: 'guided_default',
  };
}

module.exports = {
  asksExactFact,
  determineFreedom,
  freedomLevel,
};
