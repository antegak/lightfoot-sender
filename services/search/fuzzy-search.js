const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const { enrichScore, strictScore, buildReason } = require('./search-score');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'search-config.json'), 'utf8'));
  } catch {
    return { fuse: {}, maxProducts: 5 };
  }
}

function createFuse(docs) {
  const config = readConfig();
  return new Fuse(docs, {
    keys: [
      { name: 'searchableText', weight: 0.45 },
      { name: 'humanName', weight: 0.2 },
      { name: 'brand', weight: 0.12 },
      { name: 'model', weight: 0.12 },
      { name: 'colorHuman', weight: 0.06 },
      { name: 'materialHuman', weight: 0.05 },
    ],
    includeScore: true,
    threshold: config.fuse?.threshold ?? 0.38,
    ignoreLocation: config.fuse?.ignoreLocation !== false,
    minMatchCharLength: config.fuse?.minMatchCharLength || 2,
  });
}

function searchWithFuse(index, query, limit = 5) {
  const docs = Array.isArray(index?.docs) ? index.docs : [];
  const max = Math.max(1, Math.min(Number(limit) || 5, 5));
  const strict = docs
    .map((doc) => ({ doc, score: strictScore(doc, query), mode: 'strict', fuseScore: null }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (strict.length) {
    return {
      mode: 'strict',
      matches: strict.slice(0, max).map((item) => ({ ...item, reasoning: buildReason(item.doc, query, 'strict', item.score) })),
      strictMatches: strict.length,
      fuzzyMatches: 0,
      fallbackUsed: false,
    };
  }

  const fuse = createFuse(docs);
  const searchText = query.searchText || query.normalized || query.raw || '';
  const fuzzy = fuse.search(searchText)
    .map((item) => {
      const base = Math.round((1 - Math.min(item.score ?? 1, 1)) * 100);
      const score = enrichScore(item.item, query, base);
      return { doc: item.item, score, mode: 'fuzzy', fuseScore: item.score ?? null };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (fuzzy.length) {
    return {
      mode: 'fuzzy',
      matches: fuzzy.slice(0, max).map((item) => ({ ...item, reasoning: buildReason(item.doc, query, 'fuzzy', item.score) })),
      strictMatches: 0,
      fuzzyMatches: fuzzy.length,
      fallbackUsed: false,
    };
  }

  const semanticLike = docs
    .map((doc) => ({ doc, score: enrichScore(doc, query, 20), mode: 'semantic-like', fuseScore: null }))
    .filter((item) => item.score >= 25)
    .sort((a, b) => b.score - a.score);

  return {
    mode: semanticLike.length ? 'semantic-like' : 'fallback',
    matches: semanticLike.slice(0, max).map((item) => ({ ...item, reasoning: buildReason(item.doc, query, item.mode, item.score) })),
    strictMatches: 0,
    fuzzyMatches: 0,
    fallbackUsed: true,
  };
}

module.exports = {
  createFuse,
  searchWithFuse,
};
