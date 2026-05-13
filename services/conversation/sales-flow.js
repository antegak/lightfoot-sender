function inferCurrentStage(focus, parsed = {}, state = {}) {
  if (focus === 'location') return 'conversion';
  if (focus === 'sizing') return 'sizing';
  if (focus === 'brand_comparison') return 'comparison';
  if (focus === 'product_availability') return 'recommendation';
  if (focus === 'family_selection' && (!state.adultProfile?.size || !state.childProfile?.footLengthCm)) return 'clarification';
  if (focus === 'adult_selection' || focus === 'child_selection' || focus === 'teen_selection') {
    if (/recommendation|brand_list/.test(parsed.intent || '')) return 'recommendation';
    return state.activeSubject ? 'narrowing' : 'discovery';
  }
  if (parsed.intent === 'recommendation') return 'recommendation';
  return 'discovery';
}

function determineSalesFlow(state = {}) {
  if (state.currentFocus === 'family_selection') return 'family_selection_flow';
  if (state.currentFocus === 'adult_selection') return 'adult_recommendation_flow';
  if (state.currentFocus === 'child_selection' || state.currentFocus === 'teen_selection') return 'child_recommendation_flow';
  if (state.currentFocus === 'brand_comparison') return 'brand_comparison_flow';
  if (state.currentFocus === 'sizing') return 'sizing_flow';
  if (state.currentFocus === 'product_availability') return 'availability_flow';
  return 'general_consultation_flow';
}

module.exports = {
  determineSalesFlow,
  inferCurrentStage,
};
