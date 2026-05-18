const { readMediaMap } = require('./media-map');
const { resolveProductMedia } = require('./media-resolver');

function buildProductGallery(products = [], options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 8));
  const mediaMap = options.mediaMap || readMediaMap();
  const selectedProducts = (Array.isArray(products) ? products : []).slice(0, limit);
  const items = selectedProducts.map((product) => resolveProductMedia(product, { mediaMap }));
  const gallery = items.flatMap((item) => item.gallery || []);
  return {
    intent: options.intent || 'product_gallery',
    items,
    gallery,
    mediaFound: gallery.length > 0,
    selectedProducts: items.map((item) => ({
      sku: item.sku,
      productId: item.productId,
      brand: item.brand,
      model: item.model,
      color: item.color,
      previewImage: item.previewImage,
      mediaFound: item.mediaFound,
    })),
    previewImages: items.map((item) => item.previewImage).filter(Boolean),
  };
}

module.exports = {
  buildProductGallery,
};
