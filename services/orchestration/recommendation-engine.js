function buildRecommendations({ selectedIntent, activeProfileKey, conversationState = {} } = {}) {
  const child = conversationState.childProfile || {};
  const adult = conversationState.adultProfile || {};
  const healthIntent = selectedIntent === 'nail_problem'
    || selectedIntent === 'pain_problem'
    || selectedIntent === 'comfort_problem'
    || selectedIntent === 'wide_foot'
    || Boolean(conversationState.lastHealthIntent);
  if (healthIntent) {
    return {
      shouldRecommend: true,
      suggestedBrands: ['TipsieToes', 'Be Lenka'],
      suggestedUseCases: ['soft_everyday', 'wide_toe_box'],
      recommendationStyle: 'soft',
      searchHint: 'wide_toe_box_preferred',
    };
  }
  if (selectedIntent === 'child_school_selection' || child.useCase === 'school' || child.useCase === 'school_pe') {
    return {
      shouldRecommend: true,
      suggestedBrands: child.useCase === 'school_pe' ? ['Little Light', 'Saguaro kids'] : ['Little Light'],
      suggestedUseCases: child.useCase === 'school_pe' ? ['school', 'sport'] : ['school'],
      recommendationStyle: 'directional',
    };
  }
  if (selectedIntent === 'style_guidance' || adult.useCase === 'office') {
    return {
      shouldRecommend: true,
      suggestedBrands: ['Be Lenka', 'TipsieToes'],
      suggestedUseCases: ['office', 'style'],
      recommendationStyle: 'style_direction',
    };
  }
  if (selectedIntent === 'product_gallery') {
    return {
      shouldRecommend: false,
      suggestedBrands: [adult.preferredBrand || child.preferredBrand].filter(Boolean),
      suggestedUseCases: ['show_real_product_photos'],
      recommendationStyle: 'gallery',
    };
  }
  if (activeProfileKey === 'adultProfile') {
    return {
      shouldRecommend: true,
      suggestedBrands: ['TipsieToes', 'Be Lenka'],
      suggestedUseCases: [adult.useCase || 'everyday'],
      recommendationStyle: 'directional',
    };
  }
  return {
    shouldRecommend: false,
    suggestedBrands: [],
    suggestedUseCases: [],
    recommendationStyle: '',
  };
}

module.exports = {
  buildRecommendations,
};
