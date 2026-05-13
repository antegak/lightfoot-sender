const { getSizeByFootLength } = require('../../knowledge-base');

function blankProfile() {
  return {
    type: null,
    age: null,
    footLengthCm: null,
    size: null,
    preferredBrand: null,
    preferredColor: null,
    preferredMaterial: null,
    useCase: null,
    fitPreference: null,
    problemNotes: [],
    confidence: 0,
  };
}

function num(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function detectUseCase(text = '') {
  const raw = String(text || '').toLowerCase();
  if (/школ|РіРєРѕР»/.test(raw)) return 'school';
  if (/спорт|sport|бег|зал|СЃРїРѕСЂС‚/.test(raw)) return 'sport';
  if (/улиц|outdoor|поход|актив|СѓР»РёС†|Р°РєС‚РёРІ/.test(raw)) return 'outdoor';
  if (/лето|сандал|summer|Р»РµС‚Рѕ/.test(raw)) return 'summer';
  if (/офис|office|работ|РѕС„РёСЃ|СЂР°Р±РѕС‚/.test(raw)) return 'office';
  if (/гуля|ход|кажд|день|РіСѓР»|С…РѕРґ|РєР°Р¶Рґ/.test(raw)) return 'everyday';
  return null;
}

function detectFitPreference(text = '') {
  const raw = String(text || '').toLowerCase();
  if (/широк|wide|С€РёСЂРѕРє/.test(raw)) return 'wide';
  if (/мягк|soft|СЏРіРє/.test(raw)) return 'soft';
  if (/легк|light|Р»РµРіРє/.test(raw)) return 'light';
  if (/преми|premium|стиль|РїСЂРµРјРё|СЃС‚РёР»/.test(raw)) return 'premium';
  if (/дыш|breath|С‹С€/.test(raw)) return 'breathable';
  if (/прочн|долг|durable|РїСЂРѕС‡|РґРѕР»Рі/.test(raw)) return 'durable';
  return null;
}

function detectProblemNotes(text = '') {
  const raw = String(text || '').toLowerCase();
  const notes = [];
  if (/широк|wide|С€РёСЂРѕРє/.test(raw)) notes.push('wide_feet');
  if (/бол|pain|Р±РѕР»/.test(raw)) notes.push('pain');
  if (/плоскостоп|flat|РїР»РѕСЃРєРѕСЃС‚РѕРї/.test(raw)) notes.push('flat_feet');
  if (/жмет|давит|сжим|Р¶РјРµС‚|РґР°РІРёС‚|СЃР¶РёРј/.test(raw)) notes.push('squeezed_toes');
  return notes;
}

function inferSizeByFootLength(cm, type) {
  const value = num(cm);
  if (!value) return null;
  const table = type === 'adult' ? 'Adult' : (value >= 20.5 ? 'LittleLightTeen' : 'LittleLightKids');
  return getSizeByFootLength(value, table)?.size || null;
}

function scoreProfile(profile) {
  let score = 0;
  if (profile.type) score += 20;
  if (profile.size) score += 25;
  if (profile.footLengthCm) score += 25;
  if (profile.preferredBrand) score += 10;
  if (profile.preferredColor) score += 10;
  if (profile.useCase) score += 5;
  if (profile.fitPreference) score += 5;
  return Math.min(100, score);
}

function fromEntities(type, entities = {}, parsed = {}, query = '') {
  const profile = blankProfile();
  profile.type = type || null;
  profile.age = type === 'child' || type === 'teen' ? (parsed.childAge || entities.childAge || null) : null;
  profile.footLengthCm = type === 'child' || type === 'teen'
    ? (parsed.footLength || entities.childFootLength || entities.footLength || null)
    : (parsed.footLength || entities.footLength || null);
  const preferredSizeLooksChildOnly = Boolean((entities.childFootLength || entities.childAge || entities.customerType === 'kids' || entities.customerType === 'teen') && !entities.adultSize);
  profile.size = type === 'child' || type === 'teen'
    ? (parsed.size || entities.childRecommendedSize || inferSizeByFootLength(profile.footLengthCm, type) || null)
    : (parsed.size || entities.adultSize || (preferredSizeLooksChildOnly ? null : entities.preferredSize) || inferSizeByFootLength(profile.footLengthCm, 'adult') || null);
  profile.preferredBrand = parsed.brand || entities.preferredBrand || null;
  profile.preferredColor = parsed.colorHuman || parsed.color || entities.preferredColor || null;
  profile.preferredMaterial = parsed.material || entities.preferredMaterial || null;
  profile.useCase = detectUseCase(query) || entities.useCase || null;
  profile.fitPreference = detectFitPreference(query) || entities.fitPreference || null;
  profile.problemNotes = Array.from(new Set([...(entities.problemNotes || []), ...detectProblemNotes(query)]));
  profile.confidence = scoreProfile(profile);
  return profile;
}

function buildStage7CustomerProfiles(memoryState = {}, parsed = {}, query = '') {
  const entities = memoryState.entities || {};
  const adultProfile = fromEntities('adult', entities, parsed.customerType === 'adult' ? parsed : {}, query);
  const childType = parsed.customerType === 'teen' || entities.customerType === 'teen' ? 'teen' : 'child';
  const childProfile = fromEntities(childType, entities, parsed.customerType === 'kids' || parsed.customerType === 'teen' || parsed.childAge ? parsed : {}, query);
  const teenProfile = fromEntities('teen', entities, parsed.customerType === 'teen' ? parsed : {}, query);
  const childOnlyMemory = Boolean((entities.childFootLength || entities.childAge || entities.customerType === 'kids' || entities.customerType === 'teen') && !entities.adultSize);
  const hasAdult = Boolean(
    entities.adultSize
    || parsed.customerType === 'adult'
    || (entities.preferredSize && !childOnlyMemory)
    || /для\s+себя|мне|у меня|РґР»СЏ\s+СЃРµР±СЏ|РјРЅРµ|Сѓ\s+РјРµРЅСЏ/i.test(query)
  );
  const hasChild = Boolean(childProfile.footLengthCm || childProfile.age || /реб[её]н|дет|подрост|СЂРµР±|РґРµС‚|РїРѕРґСЂРѕСЃС‚/i.test(query));
  const family = hasAdult && hasChild;
  const type = family ? 'family' : (hasChild ? childType : (hasAdult ? 'adult' : (parsed.customerType || entities.customerType || 'unknown')));
  const customerProfile = family
    ? { ...blankProfile(), type: 'family', confidence: Math.max(adultProfile.confidence, childProfile.confidence) }
    : (type === 'child' || type === 'kids' || type === 'teen' ? childProfile : (type === 'adult' ? adultProfile : fromEntities(type, entities, parsed, query)));
  return {
    customerProfile,
    adultProfile,
    childProfile,
    teenProfile,
    hasAdult,
    hasChild,
    isFamily: family,
  };
}

module.exports = {
  blankProfile,
  buildStage7CustomerProfiles,
  detectFitPreference,
  detectProblemNotes,
  detectUseCase,
  inferSizeByFootLength,
};
