function hasMeaningfulProducts(context = {}) {
  return (Array.isArray(context.products) && context.products.length > 0)
    || (Array.isArray(context.normalizedProducts) && context.normalizedProducts.length > 0);
}

function needsClarification(context = {}) {
  const parsed = context.parsedQuery || {};
  if (parsed.intent === 'brand_list' || parsed.intent === 'store_question' || parsed.intent === 'location') return false;
  if (parsed.footLength || parsed.sizeRecommendation) return false;
  if ((parsed.childAge || parsed.customerType === 'kids' || parsed.customerType === 'teen') && !parsed.size) {
    return {
      reason: 'child_or_teen_without_foot_length',
      question: 'foot_length',
    };
  }
  if (parsed.intent === 'recommendation') return false;
  if (!hasMeaningfulProducts(context) && !parsed.size && !parsed.footLength && !parsed.brand && !parsed.colorCode && !parsed.materialCode) {
    return {
      reason: 'ambiguous_query',
      question: 'size_or_foot_length',
    };
  }
  return false;
}

function buildCustomerProfile(memoryState = {}, parsed = {}) {
  const entities = memoryState.entities || {};
  const customerType = parsed.customerType || entities.customerType || null;
  const adultSize = entities.adultSize || null;
  const childFootLength = entities.childFootLength || null;
  const childRecommendedSize = entities.childRecommendedSize || null;
  return {
    customerType,
    inferredCustomerProfile: {
      child: customerType === 'kids' || Boolean(parsed.childAge || entities.childAge || childFootLength || childRecommendedSize),
      teen: customerType === 'teen',
      adult: customerType === 'adult' || Boolean(adultSize),
      footLength: parsed.footLength || entities.footLength || null,
      preferredSize: parsed.size || entities.preferredSize || null,
      adultSize,
      preferredBrand: parsed.brand || entities.preferredBrand || null,
      preferredColor: parsed.colorHuman || entities.preferredColor || null,
      preferredMaterial: parsed.material || entities.preferredMaterial || null,
      childAge: parsed.childAge || entities.childAge || null,
      childFootLength,
      childRecommendedSize,
      fitNeeds: parsed.context || entities.fitNeeds || null,
    },
    previousIntent: entities.lastIntent || null,
  };
}

function computeConfidence(context = {}) {
  const summary = context.searchSummary || {};
  const topScore = Number(summary.topScores?.[0]?.score || 0);
  const productCount = Array.isArray(context.products) && context.products.length
    ? context.products.length
    : (Array.isArray(context.normalizedProducts) ? context.normalizedProducts.length : 0);
  const fallbackUsed = Boolean(summary.fallbackUsed);
  const clarification = needsClarification(context);
  let score = 55;
  if (productCount) score += 15;
  if (topScore >= 100) score += 20;
  else if (topScore >= 70) score += 12;
  else if (topScore > 0) score += 5;
  if (fallbackUsed) score -= 20;
  if (clarification) score -= 25;
  return Math.max(0, Math.min(100, score));
}

function buildReasoningObject(context = {}, humanizedResponse = {}) {
  const clarification = needsClarification(context);
  const confidence = computeConfidence(context);
  return {
    strategy: clarification ? 'clarification' : (humanizedResponse.strategy || context.detectedIntent || 'availability'),
    tone: 'friendly',
    clarificationNeeded: Boolean(clarification),
    clarificationReason: clarification?.reason || '',
    recommendationReason: Array.isArray(context.recommendationReasoning) && context.recommendationReasoning.length
      ? context.recommendationReasoning.map((item) => item.suggestion || item.reasons?.join(', ')).filter(Boolean).join('; ')
      : '',
    suggestedProducts: (context.normalizedProducts || []).slice(0, 5).map((product) => ({
      id: product.id,
      displayName: product.displayName,
      brand: product.brand,
      model: product.model,
      size: product.size,
      price: product.price,
    })),
    confidence,
    uncertaintyFlags: [
      clarification ? clarification.reason : '',
      confidence < 70 ? 'low_confidence' : '',
      context.searchSummary?.fallbackUsed ? 'fallback_search' : '',
    ].filter(Boolean),
    riskyResponseFlags: [
      confidence < 60 ? 'needs_manager_review' : '',
    ].filter(Boolean),
  };
}

function parseReasoningObject(text, fallback = {}) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  try {
    const jsonText = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return { ...fallback, rawReasoningText: raw.slice(0, 1000) };
  }
}

function buildConversationContext(memoryState = {}, parsed = {}, previousProducts = []) {
  const profile = buildCustomerProfile(memoryState, parsed);
  return {
    entities: memoryState.entities || {},
    inferredCustomerProfile: profile.inferredCustomerProfile,
    previousIntent: profile.previousIntent,
    previousProducts: Array.isArray(previousProducts) ? previousProducts.slice(0, 5) : [],
    clarificationState: {
      needed: Boolean(needsClarification({ parsedQuery: parsed, products: previousProducts })),
      reason: needsClarification({ parsedQuery: parsed, products: previousProducts })?.reason || '',
    },
  };
}

function buildReasoningSystemPrompt({ connected } = {}) {
  return [
    'You are the reasoning layer for LightFoot Sender.',
    'Return only a compact JSON object.',
    'Do not write the final customer-facing answer.',
    'Do not format products, prices, sizes, addresses, or branch availability.',
    'Do not choose a store branch or reason about stock by branch.',
    'The deterministic humanizer is the only final customer-facing renderer.',
    'Use the provided parsed query, search summary, memory, and deterministic draft only to decide strategy, confidence, clarification, and recommendation reason.',
    connected ? 'BILLZ context is available.' : 'BILLZ context is unavailable.',
    'JSON shape: {"strategy":"availability|recommendation|clarification|sizing|brand_list|unavailable","tone":"friendly","clarificationNeeded":false,"recommendationReason":"","suggestedProducts":[],"confidence":80,"uncertaintyFlags":[],"riskyResponseFlags":[]}',
  ].join('\n');
}

function buildReasoningUserPrompt(context = {}) {
  return [
    `User message: ${context.query || ''}`,
    `Parsed query: ${JSON.stringify(context.parsedQuery || null)}`,
    `Search summary: ${JSON.stringify(context.searchSummary || null)}`,
    `Memory entities: ${JSON.stringify(context.memoryEntities || {})}`,
    `Customer profile: ${JSON.stringify(context.customerProfile || null)}`,
    `Normalized products: ${JSON.stringify((context.normalizedProducts || []).slice(0, 5))}`,
    `Recommendations: ${JSON.stringify((context.normalizedRecommendations || []).slice(0, 5))}`,
    `Deterministic draft preview: ${context.humanizedResponse?.text || ''}`,
  ].join('\n');
}

module.exports = {
  buildConversationContext,
  buildCustomerProfile,
  buildReasoningObject,
  buildReasoningSystemPrompt,
  buildReasoningUserPrompt,
  computeConfidence,
  needsClarification,
  parseReasoningObject,
};
