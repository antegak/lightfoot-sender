const INTENT_PRIORITY = Object.freeze({
  nail_problem: 100,
  toe_pain: 98,
  pain_problem: 96,
  comfort_problem: 94,
  wide_foot: 92,
  walking_fatigue: 90,
  posture_problem: 88,
  health_concern: 86,
  child_school_selection: 82,
  family_selection: 80,
  product_gallery: 84,
  exact_availability: 70,
  sizing: 60,
  comparison: 55,
  style_guidance: 65,
  recommendation: 45,
  unknown: 0,
});

function has(text = '', pattern) {
  return pattern.test(String(text || '').toLocaleLowerCase('ru-RU'));
}

function detectPriorityIntent(query = '', parsed = {}, conversationState = {}) {
  const text = String(query || parsed.raw || '');
  const candidates = [];
  const add = (intent, reason) => {
    if (candidates.some((item) => item.intent === intent)) return;
    candidates.push({ intent, priority: INTENT_PRIORITY[intent] || 0, reason });
  };

  if (has(text, /вросш|ногт/i)) add('nail_problem', 'nail_problem_text');
  if (has(text, /пальц|toe/i) && has(text, /бол|дав|жм|pain/i)) add('toe_pain', 'toe_pain_text');
  if (has(text, /бол|натира|pain/i)) add('pain_problem', 'pain_text');
  if (has(text, /широк|wide/i)) add('wide_foot', 'wide_foot_text');
  if (has(text, /устал|ходить\s+тяж|fatigue/i)) add('walking_fatigue', 'walking_fatigue_text');
  if (has(text, /осанк|спин|posture/i)) add('posture_problem', 'posture_text');
  if (has(text, /комфорт|удоб|жм[её]т|давит/i)) add('comfort_problem', 'comfort_text');

  const childSchool = (conversationState.activeSubject === 'childProfile' || conversationState.activeSubject === 'teenProfile')
    && (conversationState.childProfile?.useCase === 'school'
      || conversationState.childProfile?.useCase === 'school_pe'
      || has(text, /школ|физр|смен/i));
  if (childSchool) add('child_school_selection', 'child_school_context');
  if (conversationState.customerType === 'family' || conversationState.currentFocus === 'family_selection') add('family_selection', 'family_context');
  if (has(text, /фото|покаж|как\s+выгляд|выглядят|картинк|галере/i)) add('product_gallery', 'gallery_request_text');

  if (has(text, /есть|налич|цена|сколько\s+стоит/i) || parsed.sku || parsed.barcode) add('exact_availability', 'exact_fact_text');
  if (parsed.intent === 'sizing' || parsed.footLength || parsed.sizeRecommendation) add('sizing', 'sizing_parse');
  if (has(text, /сравн|разниц|что\s+лучше|какие\s+лучше/i)) add('comparison', 'comparison_text');
  if (has(text, /офис|модно|стиль|город/i)) add('style_guidance', 'style_text');
  if (parsed.intent === 'recommendation' || conversationState.nextBestAction === 'recommend_brand' || conversationState.nextBestAction === 'recommend_direction') add('recommendation', 'recommendation_context');

  if (!candidates.length) add(parsed.intent || 'unknown', 'fallback');
  candidates.sort((a, b) => b.priority - a.priority);
  return {
    selectedIntent: candidates[0].intent,
    priority: candidates[0].priority,
    reason: candidates[0].reason,
    candidates,
  };
}

module.exports = {
  INTENT_PRIORITY,
  detectPriorityIntent,
};
