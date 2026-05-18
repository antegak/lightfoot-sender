function getActiveProfile(conversationState = {}) {
  const subject = conversationState.activeSubject || null;
  if (subject === 'adultProfile') return { key: 'adultProfile', profile: conversationState.adultProfile || {} };
  if (subject === 'teenProfile') return { key: 'teenProfile', profile: conversationState.teenProfile || conversationState.childProfile || {} };
  if (subject === 'childProfile') return { key: 'childProfile', profile: conversationState.childProfile || {} };
  if (conversationState.customerType === 'family') return { key: 'familyProfile', profile: conversationState.customerProfile || {} };
  return { key: subject || 'unknown', profile: conversationState.customerProfile || {} };
}

function buildAllowedTopics(activeProfileKey, selectedIntent) {
  if (selectedIntent === 'nail_problem' || selectedIntent === 'pain_problem' || selectedIntent === 'comfort_problem') {
    return ['comfort', 'fit', 'soft_recommendation_direction'];
  }
  if (selectedIntent === 'product_gallery') {
    return ['product_photos', 'real_gallery_images', 'current_active_subject'];
  }
  if (activeProfileKey === 'childProfile' || activeProfileKey === 'teenProfile') {
    return ['child_fit', 'school', 'sport', 'Little Light', 'Saguaro kids'];
  }
  if (activeProfileKey === 'adultProfile') {
    return ['adult_fit', 'style', 'TipsieToes', 'Be Lenka', 'Saguaro'];
  }
  return ['family_split', 'adult_fit', 'child_fit'];
}

function buildForbiddenTopics(selectedIntent, searchAllowed) {
  const topics = ['raw_sku', 'barcode', 'stock_count', 'branch_specific_stock', 'medical_promises'];
  if (!searchAllowed) topics.push('exact_product_dump', 'fake_availability', 'fake_prices');
  if (selectedIntent === 'product_gallery') topics.push('ai_generated_product_images');
  if (selectedIntent === 'nail_problem' || selectedIntent === 'pain_problem') topics.push('hard_sales');
  return topics;
}

module.exports = {
  buildAllowedTopics,
  buildForbiddenTopics,
  getActiveProfile,
};
