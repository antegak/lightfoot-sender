const { formatHumanResponse, chooseResponseStrategy } = require('./response-formatter');
const { humanizeBranches, humanizeBranch } = require('./branch-humanizer');
const { humanizeProduct, humanizeProducts, formatPrice } = require('./product-humanizer');

module.exports = {
  formatHumanResponse,
  chooseResponseStrategy,
  humanizeBranches,
  humanizeBranch,
  humanizeProduct,
  humanizeProducts,
  formatPrice,
};
