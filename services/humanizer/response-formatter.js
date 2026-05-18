const fs = require('fs');
const path = require('path');
const { humanizeBranches } = require('./branch-humanizer');
const { humanizeChildSize, humanizeProducts } = require('./product-humanizer');
const { TEMPLATES } = require('./templates');
const { needsClarification } = require('../ai/response-contract');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'humanization-config.json'), 'utf8'));
  } catch {
    return { maxProductsInResponse: 3, recommendationThreshold: 1 };
  }
}

function hasFootProblem(query = '') {
  return /(широк|болят|плоскостоп|пальц.*сжима|жмет|давит)/i.test(String(query));
}

function isPersonalFollowUp(context = {}) {
  return /лично\s+мне|мне\s+какие|для\s+меня/i.test(String(context.query || context.parsedQuery?.raw || ''));
}

function isFamilyProfileUpdate(context = {}) {
  const profile = context.customerProfile || {};
  const entities = context.memoryEntities || {};
  return Boolean(
    (profile.adultSize || entities.adultSize)
    && (profile.childFootLength || entities.childFootLength || profile.childRecommendedSize || entities.childRecommendedSize)
    && /у\s+меня|реб[её]н|дет/i.test(String(context.query || context.parsedQuery?.raw || ''))
  );
}

function isHealthFollowUp(context = {}) {
  const state = context.conversationState || {};
  return Boolean(state.lastHealthIntent && state.lastHealthIntentTurns > 0);
}

function wantsBranchInfo(context = {}) {
  const text = String(context.query || context.parsedQuery?.raw || '').toLocaleLowerCase('ru-RU');
  return Boolean(
    context.conversationState?.currentStage === 'conversion'
    || context.responsePlan?.mode === 'branch_info'
    || /адрес|где|локац|магазин|пример|приех|коенкоз|байтик|как\s+купить/.test(text)
  );
}

function filterDisplayProducts(products = [], context = {}) {
  const text = String(context.query || context.parsedQuery?.raw || '').toLocaleLowerCase('ru-RU');
  if (!/необычн|ярк|интересн|цветн|акцент/.test(text)) return products;
  const basicColor = /черн|бел|беж|сер|корич|black|white|beige|grey|gray|brown/i;
  const filtered = products.filter((product) => {
    const colorText = [
      product.displayColor,
      product.color,
      product.colorHuman,
      product.name,
      product.model,
    ].filter(Boolean).join(' ');
    return colorText && !basicColor.test(colorText);
  });
  return filtered.length ? filtered : products;
}

function chooseResponseStrategy(context = {}) {
  const intent = context.detectedIntent || context.parsedQuery?.intent || 'availability';
  const conversationState = context.conversationState || {};
  const responsePlan = context.responsePlan || {};
  if (responsePlan.mode === 'comfort_consultation') return { strategy: 'stage9_comfort_consultation', template: 'stage9_comfort_consultation' };
  if (responsePlan.mode === 'school_selection' || responsePlan.mode === 'sport_selection') return { strategy: 'stage9_school_sport_selection', template: 'stage9_school_sport_selection' };
  if (responsePlan.mode === 'style_guidance') return { strategy: 'stage9_style_guidance', template: 'stage9_style_guidance' };
  if (responsePlan.mode === 'product_gallery') return { strategy: 'product_gallery', template: 'product_gallery' };
  if (responsePlan.mode === 'availability_check') return { strategy: 'availability', template: 'availability' };
  if (responsePlan.mode === 'clarification') return { strategy: 'clarification', template: 'clarification', fallbackReason: 'orchestration_clarification' };
  if (isHealthFollowUp(context) && conversationState.nextBestAction === 'recommend_direction') {
    return { strategy: 'after_health_recommendation', template: 'after_health_recommendation' };
  }
  if (isFamilyProfileUpdate(context) && !['recommend_direction', 'acknowledge_correction', 'progress_conversation'].includes(conversationState.nextBestAction)) {
    return { strategy: 'family_profile_update', template: 'family_profile_update' };
  }
  if (conversationState.nextBestAction === 'ask_clarifying_question' && conversationState.currentFocus === 'family_selection') {
    return { strategy: 'stage7_family_discovery', template: 'stage7_family_discovery' };
  }
  if (conversationState.nextBestAction === 'acknowledge_correction') {
    return { strategy: 'stage8_correction_ack', template: 'stage8_correction_ack' };
  }
  if (conversationState.nextBestAction === 'progress_conversation') {
    return { strategy: 'stage8_progression', template: 'stage8_progression' };
  }
  if (conversationState.nextBestAction === 'recommend_direction' && (conversationState.activeSubject === 'childProfile' || conversationState.activeSubject === 'teenProfile')) {
    return { strategy: 'stage8_child_direction', template: 'stage8_child_direction' };
  }
  if (conversationState.nextBestAction === 'recommend_direction' && conversationState.activeSubject === 'adultProfile') {
    return { strategy: 'stage8_adult_direction', template: 'stage8_adult_direction' };
  }
  if (conversationState.nextBestAction === 'recommend_brand' && conversationState.activeSubject === 'adultProfile') {
    return { strategy: 'stage7_adult_brand_advice', template: 'stage7_adult_brand_advice' };
  }
  if (conversationState.nextBestAction === 'recommend_brand' && (conversationState.activeSubject === 'childProfile' || conversationState.activeSubject === 'teenProfile')) {
    return { strategy: 'stage7_child_brand_advice', template: 'stage7_child_brand_advice' };
  }
  if (conversationState.nextBestAction === 'recommend_brand' && conversationState.customerType === 'family') {
    return { strategy: 'stage7_family_brand_advice', template: 'stage7_family_brand_advice' };
  }
  if (conversationState.nextBestAction === 'compare_brands') {
    return { strategy: 'stage7_brand_comparison', template: 'stage7_brand_comparison' };
  }
  if (conversationState.nextBestAction === 'give_size_advice' && (conversationState.activeSubject === 'childProfile' || conversationState.activeSubject === 'teenProfile')) {
    return { strategy: 'stage7_child_size_advice', template: 'stage7_child_size_advice' };
  }
  const products = Array.isArray(context.products) && context.products.length
    ? context.products
    : (Array.isArray(context.normalizedProducts) ? context.normalizedProducts : []);
  const recommendations = Array.isArray(context.recommendations) && context.recommendations.length
    ? context.recommendations
    : (Array.isArray(context.normalizedRecommendations) ? context.normalizedRecommendations : []);
  if (intent === 'brand_list') return { strategy: 'brand_list', template: 'brand_list' };
  if (intent === 'store_question' || intent === 'location' || intent === 'branch_info') return { strategy: 'branch_info', template: 'branch_info' };
  if (isPersonalFollowUp(context) && (context.customerProfile?.adultSize || context.memoryEntities?.adultSize || context.memoryEntities?.preferredSize)) {
    return { strategy: 'personal_advice', template: 'personal_advice' };
  }
  const clarification = needsClarification(context);
  if (clarification) return { strategy: 'clarification', template: 'clarification', fallbackReason: clarification.reason };
  if (intent === 'recommendation' || hasFootProblem(context.query)) return { strategy: 'recommendation', template: 'recommendation' };
  if (intent === 'sizing' || context.sizeRecommendation || context.parsedQuery?.childAge) return { strategy: 'sizing', template: 'sizing' };
  if (products.length) return { strategy: 'availability', template: 'availability' };
  if (context.parsedQuery?.brand) return { strategy: 'unavailable', template: 'unavailable', fallbackReason: 'brand_without_matches' };
  if (recommendations.length) return { strategy: 'unavailable', template: 'unavailable', fallbackReason: 'recommendations_available' };
  return { strategy: 'clarification', template: 'clarification', fallbackReason: 'missing_matches' };
}

function formatHumanResponse(context = {}, options = {}) {
  const config = { ...readConfig(), ...options };
  const meta = chooseResponseStrategy(context);
  const maxProducts = Number(config.maxProductsInResponse) || 3;
  const rawProductsForDisplay = Array.isArray(context.normalizedProducts) && context.normalizedProducts.length
    ? context.normalizedProducts
    : (context.products || []);
  const productsForDisplay = filterDisplayProducts(rawProductsForDisplay, context);
  const recommendationsForDisplay = Array.isArray(context.normalizedRecommendations) && context.normalizedRecommendations.length
    ? context.normalizedRecommendations
    : (context.recommendations || []).map((item) => item.product || item);
  const productsText = humanizeProducts(productsForDisplay, maxProducts);
  const recommendationsText = humanizeProducts(recommendationsForDisplay, maxProducts);
  const branchesText = meta.template === 'branch_info' || (['availability', 'unavailable'].includes(meta.template) && (!context.responsePlan || wantsBranchInfo(context)))
    ? humanizeBranches(context.branches)
    : '';
  const template = TEMPLATES[meta.template] || TEMPLATES.availability;
  const text = template({
    ...context,
    productsText,
    recommendationsText,
    branchesText,
    config,
    fallbackReason: meta.fallbackReason || '',
  });
  const childFormats = (context.products || [])
    .map((product) => {
      try {
        return humanizeChildSize(product);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return {
    text,
    strategy: meta.strategy,
    templateUsed: meta.template,
    fallbackReason: meta.fallbackReason || '',
    recommendationReason: context.recommendationReasoning || [],
    debug: {
      detectedChildFormat: childFormats.length ? childFormats : null,
      humanizedAge: childFormats.map((item) => item.ageText).filter(Boolean),
      addressFormattingApplied: text.includes('Коенкозова') && text.includes('Байтик Баатыра'),
      reasoningObject: context.reasoningObject || null,
      customerProfile: context.customerProfile || null,
      clarificationState: meta.strategy === 'clarification' ? { needed: true, reason: meta.fallbackReason || '' } : { needed: false, reason: '' },
      galleryIntent: context.responsePlan?.galleryIntent || meta.strategy === 'product_gallery',
      mediaFound: Boolean(context.productGallery?.mediaFound),
      selectedProducts: context.productGallery?.selectedProducts || [],
    },
  };
}

module.exports = {
  chooseResponseStrategy,
  formatHumanResponse,
};
