const { BRAND_LINES } = require('../../knowledge-base');
const { humanizeBillzProduct, parseBillzProduct } = require('../../product-parser');

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || null;
}

function normalizeStock(product = {}) {
  const value = firstValue(product.stock, product.qty, product.availableQty, product.quantity, 0);
  const stock = Number(value);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizeProduct(product = {}, index = 0) {
  const parsed = product.normalized || parseBillzProduct(product);
  const human = product.human || humanizeBillzProduct(product);
  const brand = firstValue(product.brand, parsed.brand?.name);
  const line = firstValue(product.line, parsed.brand?.line, BRAND_LINES[brand]);
  const color = {
    code: firstValue(product.colorCode, parsed.color?.code),
    codes: product.colorCodes || parsed.color?.codes || (parsed.color?.code ? [parsed.color.code] : []),
    mixedCode: firstValue(product.mixedColorCode, parsed.color?.mixedCode),
    label: firstValue(product.displayColor, product.color, parsed.color?.display, parsed.color?.name, parsed.color?.code),
  };
  const material = {
    code: firstValue(product.materialCode, parsed.material?.code),
    label: firstValue(product.material, parsed.material?.name, parsed.material?.code),
  };
  const size = firstValue(product.size, parsed.size);
  const stock = normalizeStock(product);
  const displayName = firstValue(product.displayName, human.title, product.name, product.title, product.sku, `${index}`);
  const searchableText = [
    product.id,
    product.name,
    product.title,
    product.sku,
    product.vendorCode,
    product.barcode,
    brand,
    parsed.brand?.code,
    parsed.model,
    color.code,
    ...(color.codes || []),
    color.mixedCode,
    color.label,
    material.code,
    material.label,
    size,
    displayName,
    human.description,
  ].filter(Boolean).join(' ');

  return {
    id: firstValue(product.id, product.sku, product.vendorCode, product.barcode, `${index}`),
    brand,
    line,
    model: firstValue(product.model, parsed.model),
    audience: firstValue(product.audience, line),
    color,
    material,
    size,
    ageGroup: firstValue(product.ageGroup, parsed.ageGroup),
    price: Number(product.price || 0) || null,
    stock,
    available: stock > 0,
    displayName,
    searchableText,
    metadata: {
      sku: product.sku || null,
      barcode: product.barcode || null,
      vendorCode: product.vendorCode || null,
      store: parsed.store && !parsed.store.lowConfidence ? parsed.store.name : null,
      parsed,
      human,
    },
  };
}

function normalizeProducts(products = [], limit = Infinity) {
  return (Array.isArray(products) ? products : [])
    .slice(0, Number.isFinite(limit) ? limit : undefined)
    .map((product, index) => normalizeProduct(product, index));
}

module.exports = {
  normalizeProduct,
  normalizeProducts,
};
