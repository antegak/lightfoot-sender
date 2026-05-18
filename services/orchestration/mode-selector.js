function selectMode({ selectedIntent, conversationState = {}, searchAllowed } = {}) {
  if (['nail_problem', 'pain_problem', 'comfort_problem', 'wide_foot', 'toe_pain', 'walking_fatigue', 'posture_problem', 'health_concern'].includes(selectedIntent)) return 'comfort_consultation';
  if (selectedIntent === 'child_school_selection') {
    return conversationState.childProfile?.useCase === 'school_pe' ? 'sport_selection' : 'school_selection';
  }
  if (selectedIntent === 'product_gallery') return 'product_gallery';
  if (selectedIntent === 'family_selection') return 'family_guidance';
  if (selectedIntent === 'exact_availability' || searchAllowed) return 'availability_check';
  if (selectedIntent === 'sizing') return 'sizing_help';
  if (selectedIntent === 'comparison') return 'comparison';
  if (selectedIntent === 'style_guidance') return 'style_guidance';
  if (conversationState.nextBestAction === 'ask_clarifying_question') return 'clarification';
  if (conversationState.nextBestAction === 'recommend_direction' || conversationState.nextBestAction === 'recommend_brand') return 'recommendation';
  if (conversationState.currentStage === 'conversion') return 'conversion_soft';
  return 'reassurance';
}

module.exports = {
  selectMode,
};
