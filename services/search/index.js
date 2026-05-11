const { logger, LOG_CATEGORIES } = require('../logger/logger');
const { normalizeQuery } = require('./query-normalizer');
const { searchWithFuse } = require('./fuzzy-search');
const { buildRecommendations } = require('./recommendations');

function searchProductsAdvanced(index, rawQuery, options = {}) {
  const startedAt = Date.now();
  try {
    const query = normalizeQuery(rawQuery, options.memory || {});
    const limit = Math.max(1, Math.min(Number(options.limit) || 5, 5));
    const result = searchWithFuse(index, query, limit);
    const matchedDocs = result.matches.map((item) => item.doc);
    const recommendations = buildRecommendations(index, query, matchedDocs, limit);
    const response = {
      ok: true,
      query,
      mode: result.mode,
      products: matchedDocs.map((doc) => doc.raw),
      docs: matchedDocs,
      recommendations,
      searchSummary: {
        normalizedQuery: query.normalized,
        searchText: query.searchText,
        intent: query.intent,
        strictMatches: result.strictMatches,
        fuzzyMatches: result.fuzzyMatches,
        finalMatches: matchedDocs.length,
        fallbackUsed: result.fallbackUsed,
        topScores: result.matches.map((item) => ({
          name: item.doc.raw?.name || item.doc.humanName,
          score: item.score,
          fuseScore: item.fuseScore,
          mode: item.mode,
          reasons: item.reasoning?.reasons || [],
        })),
      },
      recommendationReasoning: recommendations.map((item) => ({
        name: item.product?.name || item.product?.sku || '',
        score: item.score,
        reasons: item.reasons,
        suggestion: item.suggestion,
      })),
    };
    logger.info(LOG_CATEGORIES.SEARCH, 'advanced search completed', {
      query: rawQuery,
      normalizedQuery: query.normalized,
      intent: query.intent,
      matches: matchedDocs.length,
      mode: result.mode,
      fuzzyScore: response.searchSummary.topScores[0]?.fuseScore ?? null,
      fallbackUsed: result.fallbackUsed,
    });
    logger.performance('advanced search', startedAt, { matches: matchedDocs.length, mode: result.mode });
    return response;
  } catch (error) {
    logger.error(LOG_CATEGORIES.SEARCH, 'advanced search failed', { error });
    return {
      ok: false,
      query: normalizeQuery(rawQuery, options.memory || {}),
      mode: 'fallback',
      products: [],
      docs: [],
      recommendations: [],
      searchSummary: { fallbackUsed: true, error: error?.message || 'search-failed' },
    };
  }
}

module.exports = {
  searchProductsAdvanced,
  normalizeQuery,
};
