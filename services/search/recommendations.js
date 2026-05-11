function neighborSizes(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return [];
  return [value - 1, value + 1].filter((item) => item >= 18 && item <= 52).map(String);
}

function buildRecommendations(index, query, existingDocs = [], limit = 5) {
  const docs = Array.isArray(index?.docs) ? index.docs : [];
  const existingIds = new Set(existingDocs.map((doc) => doc.id));
  const sizes = neighborSizes(query.size || query.recommendedSize);
  const candidates = docs
    .filter((doc) => !existingIds.has(doc.id))
    .map((doc) => {
      let score = 0;
      const reasons = [];
      if (sizes.includes(String(doc.size || ''))) {
        score += 30;
        reasons.push('neighbor-size');
      }
      if (query.brand && doc.brand && doc.brand !== query.brand) {
        score += 12;
        reasons.push('similar-brand');
      }
      const docColorCodes = Array.isArray(doc.colorCodes) && doc.colorCodes.length ? doc.colorCodes : (doc.colorCode ? [doc.colorCode] : []);
      if (query.colorCodes?.length && docColorCodes.length && !query.colorCodes.some((code) => docColorCodes.includes(code))) {
        score += 10;
        reasons.push('similar-color');
      }
      if (query.materialCode && doc.materialCode === query.materialCode) {
        score += 14;
        reasons.push('same-material');
      }
      if (Number(doc.stock) <= 0) score -= 40;
      return { doc, score, reasons };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 5)));

  return candidates.map((item) => ({
    product: item.doc.raw,
    score: item.score,
    reasons: item.reasons,
    suggestion: item.reasons.includes('neighbor-size')
      ? 'neighbor_size'
      : (item.reasons.includes('similar-color') ? 'similar_color' : 'similar_brand'),
  }));
}

module.exports = {
  buildRecommendations,
};
