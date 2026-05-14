function hasAny(text = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(String(text || '')));
}

function resolveActiveSubject(query = '', previous = {}, profiles = {}) {
  const text = String(query || '');
  if (hasAny(text, [/для\s+себя/i, /лично\s+мне/i, /мне\s+какие/i, /себе/i, /у\s+меня/i, /РґР»СЏ\s+СЃРµР±СЏ/i, /Р»РёС‡РЅРѕ\s+РјРЅРµ/i, /РјРЅРµ\s+РєР°Рє/i, /Сѓ\s+РјРµРЅСЏ/i])) {
    return 'adultProfile';
  }
  if (hasAny(text, [/сын/i, /доч/i, /реб[её]н/i, /дет/i, /подрост/i, /РґРѕС‡/i, /СЃС‹РЅ/i, /СЂРµР±[РµС‘]РЅ/i, /РґРµС‚/i, /РїРѕРґСЂРѕСЃС‚/i])) {
    return profiles?.childProfile?.type === 'teen' ? 'teenProfile' : 'childProfile';
  }
  if (hasAny(text, [/нам/i, /для\s+нас/i, /всем/i, /РЅР°Рј/i, /РґР»СЏ\s+РЅР°СЃ/i, /РІСЃРµРј/i])) {
    return 'family';
  }
  return previous.activeSubject || null;
}

function inferActiveSubject(query = '', parsed = {}, profiles = {}, previous = {}) {
  const explicit = resolveActiveSubject(query, previous, profiles);
  if (explicit) return explicit;
  const text = String(query || '');
  if (profiles.isFamily && hasAny(text, [/бренд/i, /какие\s+взять/i, /что\s+лучше/i, /Р±СЂРµРЅРґ/i, /РєР°РєРёРµ\s+РІР·СЏС‚СЊ/i, /С‡С‚Рѕ\s+Р»СѓС‡С€Рµ/i])) {
    return previous.activeSubject || 'family';
  }
  if (profiles.customerProfile?.type === 'child' || profiles.customerProfile?.type === 'kids') return 'childProfile';
  if (profiles.customerProfile?.type === 'teen') return 'teenProfile';
  if (profiles.customerProfile?.type === 'adult') return 'adultProfile';
  if (parsed.customerType === 'adult' || profiles.hasAdult) return 'adultProfile';
  if (parsed.customerType === 'kids') return 'childProfile';
  if (parsed.customerType === 'teen') return 'teenProfile';
  return previous.activeSubject || null;
}

function inferCurrentFocus(query = '', parsed = {}, profiles = {}, activeSubject = null, previous = {}) {
  const text = String(query || '');
  if (hasAny(text, [/адрес|где|локац|приех|пример/i, /Р°РґСЂРµСЃ|РіРґРµ|Р»РѕРєР°С†|РїСЂРёРµС…|РїСЂРёРјРµСЂ/i])) return 'location';
  if (hasAny(text, [/налич|есть|показ|вариант|черн|бел|цвет|цена|сколько/i, /РЅР°Р»РёС‡|РµСЃС‚СЊ|РїРѕРєР°Р·|РІР°СЂРёР°РЅС‚|С‡РµСЂРЅ|Р±РµР»|С†РІРµС‚|С†РµРЅР°/i])) return 'product_availability';
  if (hasAny(text, [/школ|school|РЁРєРѕР»|С€РєРѕР»/i])) {
    return activeSubject === 'adultProfile' ? 'adult_selection' : 'child_selection';
  }
  if (hasAny(text, [/бренд|какие\s+взять|какие\s+лучше|что\s+лучше|лучше\s+рассмотреть|посовет|что\s+взять/i, /Р±СЂРµРЅРґ|РєР°РєРёРµ\s+РІР·СЏС‚СЊ|РєР°РєРёРµ\s+Р»СѓС‡С€Рµ|С‡С‚Рѕ\s+Р»СѓС‡С€Рµ|Р»СѓС‡С€Рµ\s+СЂР°СЃСЃРјРѕС‚СЂ|РїРѕСЃРѕРІРµС‚/i])) {
    if (hasAny(text, [/разниц|сравн|отлич/i, /СЂР°Р·РЅРёС†|СЃСЂР°РІРЅ|РѕС‚Р»РёС‡/i])) return 'brand_comparison';
    return activeSubject === 'adultProfile' ? 'adult_selection' : (activeSubject === 'childProfile' || activeSubject === 'teenProfile' ? 'child_selection' : 'brand_comparison');
  }
  if (parsed.intent === 'sizing' || parsed.footLength || parsed.sizeRecommendation) return previous.currentFocus && previous.currentFocus !== 'unknown' ? previous.currentFocus : 'sizing';
  if (activeSubject === 'adultProfile') return 'adult_selection';
  if (activeSubject === 'childProfile') return 'child_selection';
  if (activeSubject === 'teenProfile') return 'teen_selection';
  if (profiles.isFamily) return 'family_selection';
  return previous.currentFocus || 'unknown';
}

module.exports = {
  inferActiveSubject,
  inferCurrentFocus,
  resolveActiveSubject,
};
