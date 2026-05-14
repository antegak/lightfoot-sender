function normalize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text = '') {
  return new Set(normalize(text).split(' ').filter((token) => token.length > 2));
}

function similarity(a = '', b = '') {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function detectRepetition(draft = '', previous = '', threshold = 0.78) {
  const score = similarity(draft, previous);
  return {
    blockedByRepetition: Boolean(previous && draft && score >= threshold),
    similarity: Number(score.toFixed(3)),
    threshold,
  };
}

module.exports = {
  detectRepetition,
  similarity,
};
