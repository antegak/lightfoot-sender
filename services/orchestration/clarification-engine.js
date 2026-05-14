function computeRecommendationConfidence({ selectedIntent, conversationState = {}, activeProfileKey } = {}) {
  const profile = activeProfileKey === 'adultProfile'
    ? conversationState.adultProfile || {}
    : (activeProfileKey === 'childProfile' || activeProfileKey === 'teenProfile' ? conversationState.childProfile || {} : conversationState.customerProfile || {});
  let score = 35;
  if (selectedIntent && selectedIntent !== 'unknown') score += 15;
  if (profile.size || profile.footLengthCm) score += 20;
  if (profile.useCase) score += 20;
  if (profile.fitPreference || profile.stylePreference || profile.problemNotes?.length) score += 10;
  if (selectedIntent === 'nail_problem' || selectedIntent === 'pain_problem' || selectedIntent === 'comfort_problem' || selectedIntent === 'wide_foot') score = Math.max(score, 75);
  if (selectedIntent === 'child_school_selection' && (profile.footLengthCm || profile.size)) score = Math.max(score, 80);
  return Math.max(0, Math.min(100, score));
}

function determineClarification({ selectedIntent, recommendationConfidence, conversationState = {}, riskLevel } = {}) {
  if (riskLevel === 'high') return { shouldClarify: false, clarificationAllowed: false, reason: 'safety_mode_no_question_loop' };
  if (['nail_problem', 'pain_problem', 'comfort_problem', 'wide_foot', 'child_school_selection', 'style_guidance', 'comparison'].includes(selectedIntent)) {
    return { shouldClarify: false, clarificationAllowed: false, reason: 'can_progress_without_clarification' };
  }
  if (conversationState.missingInfo?.length && recommendationConfidence < 55) {
    return { shouldClarify: true, clarificationAllowed: true, reason: 'critical_info_missing' };
  }
  return { shouldClarify: false, clarificationAllowed: false, reason: 'enough_context' };
}

module.exports = {
  computeRecommendationConfidence,
  determineClarification,
};
