function buildAiContext({
  query,
  billzContext = {},
  memoryState = {},
  maxProducts = 5,
} = {}) {
  const products = Array.isArray(billzContext.products) ? billzContext.products.slice(0, maxProducts) : [];
  const recommendations = Array.isArray(billzContext.recommendations) ? billzContext.recommendations.slice(0, maxProducts) : [];
  return {
    query: String(query || ''),
    connected: Boolean(billzContext.connected),
    products,
    recommendations,
    parsedQuery: billzContext.parsedQuery || null,
    detectedIntent: billzContext.detectedIntent || 'unknown',
    sizeRecommendation: billzContext.sizeRecommendation || null,
    searchSummary: billzContext.searchSummary || null,
    searchDebug: billzContext.searchDebug || null,
    brandSummary: billzContext.brandSummary || null,
    memorySummary: memoryState.summary || '',
    memoryEntities: memoryState.entities || {},
    recentMessages: Array.isArray(memoryState.shortTerm) ? memoryState.shortTerm.slice(-6) : [],
    recommendationReasoning: billzContext.recommendationReasoning || [],
    totalCachedProducts: Number(billzContext.totalCachedProducts || 0),
    matchedProducts: Number(billzContext.matchedProducts ?? products.length),
    searchMode: billzContext.searchMode || '',
    updatedAt: billzContext.updatedAt || new Date().toISOString(),
  };
}

module.exports = { buildAiContext };
