const {
  detectBudget,
  detectFitPreference,
  detectObjection,
  detectStylePreference,
  detectUseCase,
} = require('./customer-profile');
const { resolveActiveSubject } = require('./topic-tracker');

function pick(type, targetProfile, value) {
  return {
    hasNewInfo: Boolean(type && value !== null && value !== undefined && value !== ''),
    newInfoType: type || null,
    targetProfile: targetProfile || 'unknown',
    value: value ?? null,
    isCorrection: false,
  };
}

function detectNewInfo(message = '', parsed = {}, previousState = {}, profiles = {}) {
  const text = String(message || '');
  const targetProfile = resolveActiveSubject(text, previousState, profiles) || previousState.activeSubject || 'unknown';
  const isCorrection = /прощ|извин|не\s+9|ошиб|РїСЂРѕС‰|РёР·РІРёРЅ|РѕС€РёР±/i.test(text);
  const useCase = detectUseCase(text);
  if (useCase) return { ...pick('useCase', targetProfile, useCase), isCorrection };
  if (parsed.colorHuman || parsed.color || parsed.colorCode) return { ...pick('color', targetProfile, parsed.colorHuman || parsed.color || parsed.colorCode), isCorrection };
  if (parsed.brand) return { ...pick('brand', targetProfile, parsed.brand), isCorrection };
  if (parsed.material || parsed.materialCode) return { ...pick('material', targetProfile, parsed.material || parsed.materialCode), isCorrection };
  if (parsed.footLength) return { ...pick('footLength', targetProfile, parsed.footLength), isCorrection };
  if (parsed.size) return { ...pick('size', targetProfile === 'unknown' ? 'adultProfile' : targetProfile, parsed.size), isCorrection };
  if (parsed.childAge) return { ...pick('age', targetProfile === 'unknown' ? 'childProfile' : targetProfile, parsed.childAge), isCorrection };
  const fitPreference = detectFitPreference(text);
  if (fitPreference) return pick('fitPreference', targetProfile, fitPreference);
  const stylePreference = detectStylePreference(text);
  if (stylePreference) return pick('stylePreference', targetProfile, stylePreference);
  const budget = detectBudget(text);
  if (budget) return pick('budget', targetProfile, budget);
  const objection = detectObjection(text);
  if (objection) return pick('objection', targetProfile, objection);
  if (/что\s+лучше|сравн|разниц|лучше\s+рассмотреть|С‡С‚Рѕ\s+Р»СѓС‡С€Рµ|СЃСЂР°РІРЅ|СЂР°Р·РЅРёС†/i.test(text)) {
    return pick('comparison', targetProfile, 'comparison_request');
  }
  return pick(null, targetProfile, null);
}

module.exports = {
  detectNewInfo,
};
