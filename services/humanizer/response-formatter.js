const fs = require('fs');
const path = require('path');
const { humanizeBranches } = require('./branch-humanizer');
const { humanizeProducts } = require('./product-humanizer');
const { TEMPLATES } = require('./templates');

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
  const products = Array.isArray(context.products) ? context.products : [];
  const recommendations = Array.isArray(context.recommendations) ? context.recommendations : [];
  if (intent === 'brand_list') return { strategy: 'brand_list', template: 'brand_list' };
  if (intent === 'store_question' || intent === 'location' || intent === 'branch_info') return { strategy: 'branch_info', template: 'branch_info' };
  if (intent === 'sizing' || context.sizeRecommendation || context.parsedQuery?.childAge) return { strategy: 'sizing', template: 'sizing' };
  if (hasFootProblem(context.query)) return { strategy: 'recommendation', template: 'recommendation' };
  if (products.length) return { strategy: 'availability', template: 'availability' };
  if (context.parsedQuery?.brand) return { strategy: 'unavailable', template: 'unavailable', fallbackReason: 'brand_without_matches' };
  if (recommendations.length) return { strategy: 'unavailable', template: 'unavailable', fallbackReason: 'recommendations_available' };
  return { strategy: 'clarification', template: 'clarification', fallbackReason: 'missing_matches' };
}

function formatHumanResponse(context = {}, options = {}) {
  const config = { ...readConfig(), ...options };
  const meta = chooseResponseStrategy(context);
  const maxProducts = Number(config.maxProductsInResponse) || 3;
  const productsText = humanizeProducts(context.products || [], maxProducts);
  const recommendationsText = humanizeProducts((context.recommendations || []).map((item) => item.product || item), maxProducts);
  const branchesText = humanizeBranches(context.branches);
  const template = TEMPLATES[meta.template] || TEMPLATES.availability;
  const text = template({
    ...context,
    productsText,
    recommendationsText,
    branchesText,
    config,
  });
  return {
    text,
    strategy: meta.strategy,
    templateUsed: meta.template,
    fallbackReason: meta.fallbackReason || '',
    recommendationReason: context.recommendationReasoning || [],
  };
}

module.exports = {
  chooseResponseStrategy,
  formatHumanResponse,
};
