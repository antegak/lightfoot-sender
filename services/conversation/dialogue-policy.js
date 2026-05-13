const { PERSONA } = require('./persona');

function sanitizeConsultantText(text = '') {
  let clean = String(text || '');
  for (const phrase of PERSONA.forbiddenPhrases) {
    clean = clean.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  clean = clean.replace(/\bSKU\b/gi, '')
    .replace(/\bbarcode\b/gi, '')
    .replace(/\boffice\b/gi, '')
    .replace(/\bstock\b/gi, '')
    .replace(/артикул/gi, '')
    .replace(/остаток/gi, '');
  return clean.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function applyDialoguePolicy(text = '', state = {}) {
  const clean = sanitizeConsultantText(text);
  if (!clean) return clean;
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 6) return lines.join('\n');
  const keep = lines.slice(0, 6);
  if (state.nextBestAction === 'suggest_visit') return keep.join('\n');
  return keep.join('\n');
}

module.exports = {
  applyDialoguePolicy,
  sanitizeConsultantText,
};
