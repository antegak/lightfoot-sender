function asksAdvice(text = '') {
  return /какие|что\s+лучше|что\s+взять|что\s+брать|ну\s+что\s+взять|лучше\s+рассмотреть|посовет|подобрать|бренд|РєР°РєРёРµ|С‡С‚Рѕ\s+Р»СѓС‡С€Рµ|Р»СѓС‡С€Рµ\s+СЂР°СЃСЃРјРѕС‚СЂРµС‚СЊ|РїРѕСЃРѕРІРµС‚|РїРѕРґРѕР±СЂР°С‚СЊ|Р±СЂРµРЅРґ/i.test(String(text || ''));
}

function asksConcreteProducts(text = '', parsed = {}) {
  return Boolean(
    /есть|налич|показ|вариант|черн|бел|цвет|размер|необычн|РµСЃС‚СЊ|РЅР°Р»РёС‡|РїРѕРєР°Р·|РІР°СЂРёР°РЅС‚|С‡РµСЂРЅ|Р±РµР»|С†РІРµС‚|СЂР°Р·РјРµСЂ/i.test(String(text || ''))
    || parsed.colorCode
    || parsed.colorHuman
    || parsed.brand
    || parsed.size
  );
}

function shouldSearchProducts(state = {}, parsed = {}, searchResults = {}) {
  const query = state.query || parsed.raw || '';
  if (state.currentFocus === 'brand_comparison' && asksAdvice(query) && !parsed.colorCode && !parsed.brand) return false;
  if (state.nextBestAction === 'compare_brands' || state.nextBestAction === 'recommend_brand') return false;
  if (state.nextBestAction === 'ask_clarifying_question') return false;
  if (asksConcreteProducts(query, parsed)) return true;
  if ((state.activeSubject === 'adultProfile' && state.adultProfile?.size) || (state.activeSubject === 'childProfile' && state.childProfile?.footLengthCm)) {
    return parsed.intent === 'availability' || parsed.intent === 'product_search';
  }
  return Boolean(Array.isArray(searchResults.products) && searchResults.products.length);
}

function determineNextBestAction(state = {}, parsed = {}, searchResults = {}) {
  const query = state.query || parsed.raw || '';
  if (/для\s+себя/i.test(query) && /реб[её]н|дет/i.test(query) && (!state.adultProfile?.size || !state.childProfile?.footLengthCm)) {
    return 'ask_clarifying_question';
  }
  if (state.currentFocus === 'location') return 'suggest_visit';
  if (state.newInfo?.isCorrection && state.newInfo?.newInfoType === 'size') return 'acknowledge_correction';
  if (state.newInfo?.hasNewInfo && ['useCase', 'fitPreference', 'stylePreference', 'objection', 'budget'].includes(state.newInfo.newInfoType)) {
    return 'recommend_direction';
  }
  if (state.currentFocus === 'sizing') return 'give_size_advice';
  if (state.currentFocus === 'family_selection' && (!state.adultProfile?.size || !state.childProfile?.footLengthCm)) {
    return 'ask_clarifying_question';
  }
  if (state.lastHealthIntent && asksAdvice(query)) return 'recommend_direction';
  if (asksAdvice(query)) {
    if (state.lastRecommendation && !state.newInfo?.hasNewInfo) return 'progress_conversation';
    if (state.currentFocus === 'brand_comparison' && state.customerType !== 'family') return 'compare_brands';
    return 'recommend_brand';
  }
  if (asksConcreteProducts(query, parsed)) return 'recommend_product';
  if (searchResults?.searchSummary?.lowConfidence) return 'ask_clarifying_question';
  if (state.currentStage === 'conversion') return 'suggest_visit';
  return 'reassure';
}

module.exports = {
  determineNextBestAction,
  shouldSearchProducts,
};
