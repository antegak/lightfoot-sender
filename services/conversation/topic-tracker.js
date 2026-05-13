function hasAny(text = '', patterns = []) {
  return patterns.some((pattern) => pattern.test(String(text || '')));
}

function inferActiveSubject(query = '', parsed = {}, profiles = {}, previous = {}) {
  const text = String(query || '');
  if (hasAny(text, [/для\s+себя/i, /лично\s+мне/i, /мне\s+какие/i, /себе/i, /РґР»СЏ\s+СЃРµР±СЏ/i, /Р»РёС‡РЅРѕ\s+РјРЅРµ/i, /РјРЅРµ\s+РєР°Рє/i])) {
    return 'adultProfile';
  }
  if (hasAny(text, [/реб[её]н/i, /дет/i, /подрост/i, /РµР±/i, /РґРµС‚/i, /РїРѕРґСЂРѕСЃС‚/i])) {
    return profiles?.childProfile?.type === 'teen' ? 'teenProfile' : 'childProfile';
  }
  if (profiles.isFamily && hasAny(text, [/бренд/i, /какие\s+взять/i, /что\s+лучше/i, /Р±СЂРµРЅРґ/i, /РєР°РєРёРµ/i, /С‡С‚Рѕ\s+Р»СѓС‡С€Рµ/i])) {
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
  if (hasAny(text, [/адрес|где|локац|приех|пример/i, /Р°РґСЂРµСЃ|РіРґРµ|РїСЂРёРјРµСЂ/])) return 'location';
  if (hasAny(text, [/налич|есть|показ|вариант|черн|бел|цвет/i, /РЅР°Р»РёС‡|РµСЃС‚СЊ|РїРѕРєР°Р¶|С‡РµСЂРЅ|С†РІРµС‚/])) return 'product_availability';
  if (hasAny(text, [/бренд|какие\s+взять|что\s+лучше|лучше\s+рассмотреть/i, /Р±СЂРµРЅРґ|РєР°РєРёРµ|С‡С‚Рѕ\s+Р»СѓС‡С€Рµ|Р»СѓС‡С€Рµ\s+СЂР°СЃСЃРјРѕС‚СЂ/])) {
    if (hasAny(text, [/разниц|сравн|отлич/i, /СЂР°Р·РЅРёС†|СЃСЂР°РІРЅ|РѕС‚Р»РёС‡/])) return 'brand_comparison';
    return activeSubject === 'adultProfile' ? 'adult_selection' : (activeSubject === 'childProfile' || activeSubject === 'teenProfile' ? 'child_selection' : 'brand_comparison');
  }
  if (parsed.intent === 'sizing' || parsed.footLength || parsed.sizeRecommendation) return 'sizing';
  if (profiles.isFamily) return 'family_selection';
  if (activeSubject === 'adultProfile') return 'adult_selection';
  if (activeSubject === 'childProfile') return 'child_selection';
  if (activeSubject === 'teenProfile') return 'teen_selection';
  return previous.currentFocus || 'unknown';
}

module.exports = {
  inferActiveSubject,
  inferCurrentFocus,
};
