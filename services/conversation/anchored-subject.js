const SUBJECT_TTL_TURNS = 4;

function has(text = '', pattern) {
  return pattern.test(String(text || '').toLocaleLowerCase('ru-RU'));
}

function detectExplicitSubject(query = '', parsed = {}, profiles = {}) {
  const text = String(query || '');
  if (has(text, /\u0434\u043b\u044f\s+\u0441\u0435\u0431\u044f|\u043b\u0438\u0447\u043d\u043e\s+\u043c\u043d\u0435|\u043c\u043d\u0435\s+\u043a\u0430\u043a|\u0441\u0435\u0431\u0435|\u0443\s+\u043c\u0435\u043d\u044f/)) {
    return { profile: 'adultProfile', confidence: 96, reason: 'explicit_adult' };
  }
  if (has(text, /\u0440\u0435\u0431[\u0435\u0451]\u043d|\u0434\u0435\u0442|\u0441\u044b\u043d|\u0434\u043e\u0447|\u043f\u043e\u0434\u0440\u043e\u0441\u0442/) || parsed.customerType === 'kids' || parsed.customerType === 'teen' || parsed.childAge) {
    return {
      profile: profiles?.childProfile?.type === 'teen' || parsed.customerType === 'teen' ? 'teenProfile' : 'childProfile',
      confidence: 95,
      reason: 'explicit_child',
    };
  }
  if (has(text, /\u0434\u043b\u044f\s+\u043d\u0430\u0441|\u043d\u0430\u043c|\u0432\u0441\u0435\u043c|\u0441\u0435\u043c\u044c\u0435/)) {
    return { profile: 'family', confidence: 92, reason: 'explicit_family' };
  }
  return null;
}

function isFollowUpMessage(query = '', parsed = {}) {
  const text = String(query || '').toLocaleLowerCase('ru-RU').trim();
  if (!text) return false;
  if (detectExplicitSubject(text, parsed)) return false;
  if (parsed.footLength || parsed.childAge || parsed.customerType) return false;
  return has(text, /^(?:\u0430\s+)?(?:\u043f\u043e\u043a\u0430\u0436\u0438|\u043a\u0430\u043a\u0438\u0435|\u043a\u0430\u043a\u0443\u044e|\u0438\u0445|\u044d\u0442\u0438|\u044d\u0442\u043e|\u0445\u043e\u0447\u0443|\u0435\u0441\u0442\u044c\s+\u0444\u043e\u0442\u043e|\u0444\u043e\u0442\u043e|\u043a\u0430\u043a\s+\u0432\u044b\u0433\u043b\u044f\u0434|\u0432\u0430\u0440\u0438\u0430\u043d\u0442|\u0447\u0435\u0440\u043d|\u0431\u0435\u043b|be\s+lenka|belenka)/);
}

function isProductFollowUpMessage(query = '', parsed = {}) {
  const text = String(query || '').toLocaleLowerCase('ru-RU').trim();
  if (!text) return false;
  return parsed.intent === 'product_gallery'
    || has(text, /\u0444\u043e\u0442\u043e|\u043f\u043e\u043a\u0430\u0436|\u043a\u0430\u043a\s+\u0432\u044b\u0433\u043b\u044f\u0434|\u0432\u044b\u0433\u043b\u044f\u0434\u044f\u0442|\u0432\u0430\u0440\u0438\u0430\u043d\u0442|\u044d\u0442\u0438|\u044d\u0442\u043e|be\s+lenka|belenka|\u0447\u0435\u0440\u043d|\u0431\u0435\u043b/);
}

function ageAnchor(previousAnchor = {}) {
  if (!previousAnchor?.profile) return null;
  const remaining = Number(previousAnchor.expiresAfterTurns ?? SUBJECT_TTL_TURNS) - 1;
  if (remaining <= 0) return null;
  return {
    ...previousAnchor,
    expiresAfterTurns: remaining,
    reason: previousAnchor.reason || 'carried_subject',
  };
}

function buildAnchor(profile, confidence, reason) {
  return {
    profile,
    confidence,
    expiresAfterTurns: SUBJECT_TTL_TURNS,
    lastUpdatedAt: new Date().toISOString(),
    reason,
  };
}

function resolveAnchoredSubject({
  query = '',
  parsedQuery = {},
  profiles = {},
  previousAnchor = null,
  inferredSubject = null,
} = {}) {
  const explicit = detectExplicitSubject(query, parsedQuery, profiles);
  if (explicit) return buildAnchor(explicit.profile, explicit.confidence, explicit.reason);

  const carried = ageAnchor(previousAnchor);
  const followUp = isFollowUpMessage(query, parsedQuery);
  const productFollowUp = isProductFollowUpMessage(query, parsedQuery);
  if (profiles?.isFamily && !productFollowUp && has(query, /\u0431\u0440\u0435\u043d\u0434|\u043a\u0430\u043a\u0438\u0435\s+\u0432\u0437\u044f\u0442\u044c|\u0447\u0442\u043e\s+\u043b\u0443\u0447\u0448\u0435|\u043f\u043e\u0441\u043e\u0432\u0435\u0442/)) {
    return buildAnchor('family', 90, 'family_advice_request');
  }

  if (carried && (followUp || Number(carried.confidence || 0) >= 80)) {
    return {
      ...carried,
      confidence: Math.max(followUp ? 70 : 80, Number(carried.confidence || 0)),
      reason: followUp ? 'anchored_follow_up' : 'strong_anchor_carried',
    };
  }

  if (inferredSubject && inferredSubject !== 'unknown') {
    const confidence = inferredSubject === previousAnchor?.profile ? 88 : 76;
    return buildAnchor(inferredSubject, confidence, 'inferred_subject');
  }

  return carried;
}

module.exports = {
  SUBJECT_TTL_TURNS,
  detectExplicitSubject,
  isFollowUpMessage,
  resolveAnchoredSubject,
};
