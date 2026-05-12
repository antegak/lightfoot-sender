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

function chooseResponseStrategy(context = {}) {
  const intent = context.detectedIntent || context.parsedQuery?.intent || 'availability';
  const products = Array.isArray(context.products) && context.products.length
    ? context.products
    : (Array.isArray(context.normalizedProducts) ? context.normalizedProducts : []);
  const recommendations = Array.isArray(context.recommendations) && context.recommendations.length
    ? context.recommendations
    : (Array.isArray(context.normalizedRecommendations) ? context.normalizedRecommendations : []);
  if (intent === 'brand_list') return { strategy: 'brand_list', template: 'brand_list' };
  if (intent === 'store_question' || intent === 'location' || intent === 'branch_info') return { strategy: 'branch_info', template: 'branch_info' };
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
  const productsForDisplay = Array.isArray(context.normalizedProducts) && context.normalizedProducts.length
    ? context.normalizedProducts
    : (context.products || []);
  const recommendationsForDisplay = Array.isArray(context.normalizedRecommendations) && context.normalizedRecommendations.length
    ? context.normalizedRecommendations
    : (context.recommendations || []).map((item) => item.product || item);
  const productsText = humanizeProducts(productsForDisplay, maxProducts);
  const recommendationsText = humanizeProducts(recommendationsForDisplay, maxProducts);
  const branchesText = humanizeBranches(context.branches);
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
    },
  };
}

module.exports = {
  chooseResponseStrategy,
  formatHumanResponse,
};
