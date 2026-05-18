const { parseBillzProduct } = require('../../product-parser');
const { findMappedMedia, readMediaMap } = require('./media-map');

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractUrl(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url || item.src || item.href || item.image || item.imageUrl || item.original || item.preview || '';
}

function isUsableImageUrl(value = '') {
  const text = String(value || '').trim();
  return Boolean(text && (/^https?:\/\//i.test(text) || /^file:\/\//i.test(text) || /^[a-z]:\\/i.test(text) || text.startsWith('/')));
}

function collectProductImages(product = {}, mapped = null) {
  const sourceLists = [
    mapped?.images,
    mapped?.gallery,
    mapped?.image,
    mapped?.previewImage,
    product.images,
    product.gallery,
    product.photos,
    product.media,
    product.image,
    product.imageUrl,
    product.image_url,
    product.mainImage,
    product.photo,
    product.picture,
    product.pictures,
  ];
  const urls = [];
  for (const source of sourceLists) {
    for (const item of asList(source)) {
      const url = extractUrl(item);
      if (isUsableImageUrl(url) && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

function resolveProductMedia(product = {}, options = {}) {
  const mediaMap = options.mediaMap || readMediaMap();
  const mapped = findMappedMedia(product, mediaMap);
  const parsed = product.parsed || parseBillzProduct(product);
  const images = collectProductImages(product, mapped);
  const brand = product.brand || parsed.brand?.name || product.normalizedProduct?.brand || mapped?.brand || '';
  const model = product.model || parsed.model || product.normalizedProduct?.model || mapped?.model || '';
  const color = product.color || parsed.color?.name || parsed.color?.code || product.normalizedProduct?.color?.label || mapped?.color || '';
  const sku = product.sku || product.vendorCode || parsed.sku || mapped?.sku || '';
  const productId = product.id || mapped?.productId || '';
  const gallery = images.map((url, index) => ({
    url,
    alt: [brand, model, color].filter(Boolean).join(' '),
    index,
    source: mapped ? 'media-map' : 'product',
  }));
  return {
    sku,
    productId,
    brand,
    model,
    color,
    images,
    gallery,
    previewImage: images[0] || '',
    tags: Array.from(new Set([brand, model, color, ...(mapped?.tags || [])].filter(Boolean))),
    mediaFound: images.length > 0,
    source: mapped ? 'media-map' : (images.length ? 'product-fields' : 'none'),
  };
}

module.exports = {
  collectProductImages,
  isUsableImageUrl,
  resolveProductMedia,
};
