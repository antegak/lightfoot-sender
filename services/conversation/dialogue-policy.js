const { PERSONA } = require('./persona');
const { detectRepetition } = require('./repetition-detector');

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

function countQuestions(text = '') {
  return (String(text || '').match(/\?/g) || []).length;
}

function applyDialoguePolicy(text = '', state = {}, options = {}) {
  const clean = sanitizeConsultantText(text);
  if (!clean) return clean;
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  const maxLines = state.freedomLevel === 'proactive_consultant' ? 8 : 6;
  const keep = lines.slice(0, maxLines);
  let result = keep.join('\n');
  if (countQuestions(result) > 1) {
    const resultLines = result.split('\n');
    let seenQuestion = false;
    result = resultLines.filter((line) => {
      if (!line.includes('?')) return true;
      if (seenQuestion) return false;
      seenQuestion = true;
      return true;
    }).join('\n');
  }
  const repetition = detectRepetition(result, options.previousAssistantText || state.lastAssistantResponse || '');
  return {
    text: result,
    repetition,
  };
}

module.exports = {
  applyDialoguePolicy,
  countQuestions,
  sanitizeConsultantText,
};
