const BILLZ_ADMIN_BASE_URL = 'https://api-admin.billz.ai';
const { logger, LOG_CATEGORIES } = require('./services/logger/logger');
const { COLORS, MATERIALS, STORES, formatStoreAddress, getSizeByFootLength } = require('./knowledge-base');
const {
  detectBrand: parseProductBrand,
  detectColor: parseProductColor,
  detectMaterial: parseProductMaterial,
  detectModel: parseProductModel,
  detectSku: parseProductSku,
  detectStore: parseProductStore,
  humanizeBillzProduct,
  parseBillzProduct,
} = require('./product-parser');
const { detectIntent, parseCustomerQuery } = require('./intent-detector');
const { buildBrandSummary, buildProductIndex, normalizeSearchText, searchProductIndex } = require('./product-index');
const { searchProductsAdvanced } = require('./services/search');
const BILLZ_API_V1_BASE_URL = 'https://api.billz.uz/v1/';
const BILLZ_API_V2_BASE_URL = 'https://api.billz.uz/v2/';
const MIN_REQUEST_GAP_MS = 600;
const TOKEN_EXPIRY_SKEW_MS = 30 * 1000;
const DEFAULT_PRODUCTS_PAGE = 1;
const DEFAULT_PRODUCTS_LIMIT = 10;
const MAX_PRODUCTS_LIMIT = 100;
const PRODUCT_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const PRODUCT_LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
const PRODUCT_LOCAL_CACHE_LIMIT = 2500;

const DIAGNOSTIC_METHODS = [
  'GET /v2/products',
  'GET /v2/products?search',
];

const tokenState = {
  secretToken: '',
  accessToken: '',
  expiresAt: 0,
  authPromise: null,
};

let queueTail = Promise.resolve();
let lastRequestAt = 0;
let rpcRequestId = 1;
const productSearchCache = new Map();
const productListCache = {
  secretToken: '',
  createdAt: 0,
  products: [],
  total: 0,
  pagesLoaded: 0,
};

const COLOR_MAP = COLORS;

function logBillz(tag, message, meta = {}) {
  const safeMeta = meta && typeof meta === 'object' ? meta : { value: String(meta) };
  logger.info(LOG_CATEGORIES.BILLZ, `${tag}: ${message}`, safeMeta);
}

function previewJson(value, maxLength = Infinity) {
  if (value === undefined) return '';
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return String(json);
    return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;
  } catch {
    return '[unserializable]';
  }
}

function normalizeBaseUrl(url, fallback) {
  return String(url || fallback || '').trim().replace(/\/+$/, '');
}

function getBillzAuthBaseUrl() {
  return normalizeBaseUrl(process.env.BILLZ_AUTH_BASE_URL, BILLZ_ADMIN_BASE_URL);
}

function getBillzAdminBaseUrl() {
  return normalizeBaseUrl(process.env.BILLZ_ADMIN_BASE_URL || process.env.BILLZ_AUTH_BASE_URL, BILLZ_ADMIN_BASE_URL);
}

function getBillzApiV1BaseUrl() {
  return normalizeBaseUrl(process.env.BILLZ_API_V1_BASE_URL, BILLZ_API_V1_BASE_URL);
}

function getBillzApiV2BaseUrl() {
  return normalizeBaseUrl(process.env.BILLZ_API_V2_BASE_URL, BILLZ_API_V2_BASE_URL);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueue(task) {
  const run = queueTail
    .catch(() => {})
    .then(async () => {
      const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
      if (waitMs) await delay(waitMs);
      lastRequestAt = Date.now();
      return task();
    });
  queueTail = run;
  return run;
}

async function readJsonResponse(response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function normalizeBillzError(error, status = 0) {
  const message = String(error?.message || error || '').toLowerCase();
  if (status === 401 || message.includes('unauthorized') || message.includes('token') || message.includes('jwt')) return 'auth-error';
  if (status === 403 || message.includes('forbidden')) return 'no-access';
  if (status === 404) return 'not-found';
  if (status === 408) return 'timeout';
  if (status === 429 || message.includes('rate limit')) return 'rate-limit';
  if (status >= 500) return 'server-error';
  if (message.includes('fetch failed') || message.includes('network') || message.includes('enotfound') || message.includes('econn')) {
    return 'network';
  }
  return 'unknown';
}

function decodeJwtExpiresAt(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const data = JSON.parse(json);
    return Number(data.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function extractAccessToken(payload) {
  return String(
    payload?.data?.access_token ||
    payload?.data?.accessToken ||
    payload?.access_token ||
    payload?.accessToken ||
    ''
  ).trim();
}

function extractExpiresAt(payload, accessToken) {
  const explicitExpiresAt = payload?.data?.expires_at || payload?.data?.expiresAt || payload?.expires_at || payload?.expiresAt;
  if (explicitExpiresAt) {
    const parsed = Date.parse(explicitExpiresAt);
    if (Number.isFinite(parsed)) return parsed;
  }

  const expiresIn = Number(payload?.data?.expires_in || payload?.data?.expiresIn || payload?.expires_in || payload?.expiresIn || 0);
  if (expiresIn > 0) return Date.now() + expiresIn * 1000;

  return decodeJwtExpiresAt(accessToken) || (Date.now() + 24 * 60 * 60 * 1000);
}

function clearToken() {
  tokenState.accessToken = '';
  tokenState.expiresAt = 0;
  tokenState.authPromise = null;
}

function isTokenValid(secretToken) {
  return Boolean(
    tokenState.accessToken &&
    tokenState.secretToken === secretToken &&
    tokenState.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now()
  );
}

function normalizeApiErrorPayload(data, response) {
  const errorObject = data?.error && typeof data.error === 'object' ? data.error : null;
  const message =
    errorObject?.message ||
    data?.message ||
    (typeof data?.error === 'string' ? data.error : '') ||
    response?.statusText ||
    'BILLZ request failed';

  return {
    code: errorObject?.code || data?.code || normalizeBillzError(message, response?.status || 0),
    message: String(message),
    data: errorObject?.data ?? data?.data ?? data ?? null,
  };
}

async function fetchJson(url, options = {}) {
  const response = await enqueue(() => fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-cache',
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }));
  const data = await readJsonResponse(response);
  return { response, data };
}

async function auth(secretToken, options = {}) {
  const cleanSecret = String(secretToken || options.secretToken || '').trim();
  if (!cleanSecret) {
    const error = new Error('secret_token is empty');
    error.code = 'missing-secret';
    throw error;
  }

  if (!options.force && isTokenValid(cleanSecret)) {
    return { accessToken: tokenState.accessToken, expiresAt: tokenState.expiresAt };
  }

  if (tokenState.authPromise && tokenState.secretToken === cleanSecret && !options.force) return tokenState.authPromise;

  logBillz('auth', 'login start');
  tokenState.secretToken = cleanSecret;
  tokenState.authPromise = fetchJson(`${getBillzAuthBaseUrl()}/v1/auth/login`, {
    method: 'POST',
    body: { secret_token: cleanSecret },
  })
    .then(({ response, data }) => {
      logBillz('auth', 'login response', { status: response.status, body: previewJson(data, 1200) });
      if (!response.ok || data?.error) {
        const apiError = normalizeApiErrorPayload(data, response);
        const error = new Error(apiError.message);
        error.status = response.status;
        error.code = normalizeBillzError(error, response.status);
        error.data = apiError.data;
        throw error;
      }

      const accessToken = extractAccessToken(data);
      if (!accessToken) {
        const error = new Error('data.access_token is missing');
        error.code = 'auth-error';
        error.data = data;
        throw error;
      }

      tokenState.accessToken = accessToken;
      tokenState.expiresAt = extractExpiresAt(data, accessToken);
      logBillz('auth', 'login success', { expiresAt: new Date(tokenState.expiresAt).toISOString() });
      return { accessToken, expiresAt: tokenState.expiresAt };
    })
    .catch((error) => {
      clearToken();
      logBillz('error', 'auth failed', {
        code: error.code || normalizeBillzError(error, error.status),
        message: error.message,
        status: error.status || 0,
        data: error.data ?? null,
      });
      throw error;
    })
    .finally(() => {
      tokenState.authPromise = null;
    });

  return tokenState.authPromise;
}

function buildUrl(path, query = {}) {
  const base = getBillzAdminBaseUrl();
  const url = new URL(`${base}${String(path || '').startsWith('/') ? '' : '/'}${path || ''}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function restRequest({ path, method = 'GET', query = {}, body }, options = {}) {
  const secretToken = String(options.secretToken || '').trim();
  const authResult = await auth(secretToken, options);
  const url = buildUrl(path, query);
  const requestMeta = { method, url, query, body: body === undefined ? null : body };

  logBillz('request', `${method} ${path}`, { query, body: previewJson(body, 2000) });
  const { response, data } = await fetchJson(url, {
    method,
    headers: {
      Authorization: `Bearer ${authResult.accessToken}`,
      ...(options.headers || {}),
    },
    body,
  });
  logBillz('response', `${method} ${path}`, { status: response.status, body: previewJson(data, 3000) });

  if (response.status === 401 && !options._retriedAuth) {
    clearToken();
    await auth(secretToken, { force: true });
    return restRequest({ path, method, query, body }, { ...options, _retriedAuth: true });
  }

  if (response.status === 429 && !options._rateLimitPaused) {
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    return {
      ok: false,
      status: 429,
      code: 'rate-limit',
      result: 'rate limit',
      error: { code: 'rate-limit', message: 'BILLZ rate limit', data },
      data: null,
      raw: data,
      request: requestMeta,
    };
  }

  if (!response.ok || data?.error) {
    const apiError = normalizeApiErrorPayload(data, response);
    logBillz('error', `${method} ${path}`, {
      status: response.status,
      code: apiError.code,
      message: apiError.message,
      data: previewJson(apiError.data, 2000),
    });
    return {
      ok: false,
      status: response.status,
      code: normalizeBillzError(apiError.message, response.status),
      result: apiError.message,
      errorMessage: apiError.message,
      errorData: apiError.data,
      error: apiError,
      data: null,
      raw: data,
      request: requestMeta,
    };
  }

  return {
    ok: true,
    status: response.status,
    code: 'ok',
    result: 'success',
    data,
    raw: data,
    request: requestMeta,
  };
}

function clampLimit(limit) {
  return Math.max(1, Math.min(MAX_PRODUCTS_LIMIT, parseInt(limit, 10) || DEFAULT_PRODUCTS_LIMIT));
}

function normalizePage(page) {
  return Math.max(1, parseInt(page, 10) || DEFAULT_PRODUCTS_PAGE);
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getProductCount(payload) {
  const count = payload?.count ?? payload?.data?.count ?? payload?.total ?? payload?.data?.total;
  if (Number.isFinite(Number(count))) return Number(count);
  return extractProducts(payload).length;
}

function getProductCacheKey({ query, page, limit }) {
  return JSON.stringify({
    q: String(query || '').trim().toLocaleLowerCase('ru-RU'),
    page: normalizePage(page),
    limit: clampLimit(limit),
  });
}

function readProductCache(key) {
  const hit = productSearchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > PRODUCT_SEARCH_CACHE_TTL_MS) {
    productSearchCache.delete(key);
    return null;
  }
  return hit.value || null;
}

function writeProductCache(key, value) {
  productSearchCache.set(key, { createdAt: Date.now(), value });
}

async function getProducts(secretToken, options = {}) {
  const page = normalizePage(options.page);
  const limit = clampLimit(options.limit);
  const query = { page, limit };
  if (options.lastUpdatedDate) query.last_updated_date = String(options.lastUpdatedDate);
  if (options.search) query.search = String(options.search).trim();

  const result = await restRequest({ path: '/v2/products', method: 'GET', query }, { secretToken });
  const products = extractProducts(result.data);
  if (!(result.ok && Array.isArray(products))) {
    return { ...result, ok: false, code: result.code || 'invalid-products-response', products: [] };
  }

  logBillz('request', 'products loaded', { page, limit, search: query.search || '', count: products.length, total: getProductCount(result.data) });
  return { ...result, products, count: getProductCount(result.data), page, limit };
}

async function getCatalog(secretToken, options = {}) {
  return getProducts(secretToken, options);
}

async function getCatalogPage(secretToken, page = DEFAULT_PRODUCTS_PAGE, limit = DEFAULT_PRODUCTS_LIMIT) {
  return getCatalog(secretToken, { page, limit });
}

async function searchCatalog(secretToken, searchString, page = DEFAULT_PRODUCTS_PAGE, limit = DEFAULT_PRODUCTS_LIMIT) {
  const query = String(searchString || '').trim();
  const normalizedPage = normalizePage(page);
  const normalizedLimit = clampLimit(limit);
  const cacheKey = getProductCacheKey({ query, page: normalizedPage, limit: normalizedLimit });
  const cached = readProductCache(cacheKey);
  if (cached) {
    logBillz('request', 'products search cache hit', { q: query.slice(0, 80), page: normalizedPage, limit: normalizedLimit });
    return { ...cached, cached: true };
  }

  const result = await getProducts(secretToken, { page: normalizedPage, limit: normalizedLimit, search: query });
  if (!result.ok) return result;

  logBillz('request', 'products search loaded', {
    q: query.slice(0, 80),
    page: normalizedPage,
    limit: normalizedLimit,
    count: result.products.length,
    total: result.count,
  });

  writeProductCache(cacheKey, result);
  return { ...result, cached: false };
}

async function searchProducts(secretToken, searchString, page = DEFAULT_PRODUCTS_PAGE, limit = DEFAULT_PRODUCTS_LIMIT) {
  const parsed = parseQuery(searchString);
  if (parsed.sku || parsed.barcode) return searchCatalog(secretToken, parsed.sku || parsed.barcode, page, limit);
  return searchProductsHybrid(secretToken, searchString, limit);
}

function isProductListCacheFresh(secretToken) {
  return Boolean(
    productListCache.secretToken === String(secretToken || '').trim() &&
    productListCache.products.length &&
    Date.now() - productListCache.createdAt <= PRODUCT_LOCAL_CACHE_TTL_MS
  );
}

async function getCachedProducts(secretToken, options = {}) {
  const cleanSecret = String(secretToken || '').trim();
  const force = Boolean(options.force);
  if (!force && isProductListCacheFresh(cleanSecret)) {
    logBillz('request', 'products local cache hit', {
      count: productListCache.products.length,
      pagesLoaded: productListCache.pagesLoaded,
    });
    logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
      stage: 'cache:hit',
      totalProductsInCache: productListCache.products.length,
      pagesLoaded: productListCache.pagesLoaded,
    });
    return {
      ok: true,
      products: productListCache.products,
      totalCachedProducts: productListCache.products.length,
      count: productListCache.total || productListCache.products.length,
      cached: true,
      pagesLoaded: productListCache.pagesLoaded,
    };
  }

  const allProducts = [];
  let total = 0;
  let pagesLoaded = 0;
  for (let page = 1; allProducts.length < PRODUCT_LOCAL_CACHE_LIMIT; page += 1) {
    const remaining = PRODUCT_LOCAL_CACHE_LIMIT - allProducts.length;
    const result = await getProducts(cleanSecret, { page, limit: Math.min(MAX_PRODUCTS_LIMIT, remaining) });
    if (!result.ok) return { ...result, products: [], totalCachedProducts: 0, cached: false, pagesLoaded };

    const pageProducts = Array.isArray(result.products) ? result.products : [];
    allProducts.push(...pageProducts);
    total = result.count || total || allProducts.length;
    pagesLoaded += 1;
    if (pageProducts.length < Math.min(MAX_PRODUCTS_LIMIT, remaining)) break;
  }

  const normalized = allProducts.slice(0, PRODUCT_LOCAL_CACHE_LIMIT).map(normalizeBillzProduct);
  productListCache.secretToken = cleanSecret;
  productListCache.createdAt = Date.now();
  productListCache.products = normalized;
  productListCache.total = total || normalized.length;
  productListCache.pagesLoaded = pagesLoaded;

  logBillz('request', 'products local cache loaded', {
    count: normalized.length,
    total: productListCache.total,
    pagesLoaded,
  });
  logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
    stage: 'cache:loaded',
    totalProductsInCache: normalized.length,
    billzTotal: productListCache.total,
    pagesLoaded,
  });

  return {
    ok: true,
    products: normalized,
    totalCachedProducts: normalized.length,
    count: productListCache.total,
    cached: false,
    pagesLoaded,
  };
}

async function searchProductsHybrid(secretToken, query, limit = 5, options = {}) {
  const parsedQuery = parseQuery(query);
  parsedQuery.memory = options.memory || {};
  const normalizedLimit = Math.max(1, Math.min(20, Number(limit) || 5));
  logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
    stage: 'hybrid:start',
    userQuery: String(query || ''),
    parsedQuery,
    detectedIntent: parsedQuery.intent,
    detectedColorHuman: parsedQuery.colorHuman || parsedQuery.color || null,
    detectedColorCode: parsedQuery.colorCode || null,
    detectedColorCodes: parsedQuery.colorCodes || [],
    excludeBrand: parsedQuery.excludeBrand || null,
  });

  if (parsedQuery.sku || parsedQuery.barcode) {
    const searchTerm = parsedQuery.sku || parsedQuery.barcode;
    const result = await searchCatalog(secretToken, searchTerm, 1, normalizedLimit);
    if (!result.ok) return { ...result, products: [], parsedQuery, searchMode: 'api', totalCachedProducts: productListCache.products.length, matchedProducts: 0 };
    const products = result.products.slice(0, normalizedLimit).map(normalizeBillzProduct);
    return {
      ...result,
      products,
      parsedQuery,
      searchMode: 'api',
      totalCachedProducts: productListCache.products.length,
      matchedProducts: products.length,
    };
  }

  const cache = await getCachedProducts(secretToken);
  if (!cache.ok) return { ...cache, products: [], parsedQuery, searchMode: 'local', matchedProducts: 0 };

  const localResult = searchProductsLocal(cache.products, parsedQuery, normalizedLimit);
  return {
    ok: true,
    status: 200,
    code: 'ok',
    result: 'success',
    data: localResult.products,
    raw: localResult.products,
    products: localResult.products,
    count: localResult.matchedProducts,
    parsedQuery: localResult.parsedQuery,
    normalizedQuery: localResult.normalizedQuery,
    brandSummary: localResult.brandSummary,
    searchSummary: localResult.searchSummary,
    recommendations: localResult.recommendations || [],
    recommendationReasoning: localResult.recommendationReasoning || [],
    searchMode: localResult.searchMode || 'local',
    totalCachedProducts: localResult.totalCachedProducts,
    matchedProducts: localResult.matchedProducts,
    cached: cache.cached,
    pagesLoaded: cache.pagesLoaded,
  };
}

function getObjectValues(object) {
  if (!object || typeof object !== 'object') return [];
  return Object.values(object).flatMap((value) => {
    if (value === undefined || value === null) return [];
    if (typeof value === 'object') return getObjectValues(value);
    return [String(value)];
  });
}

function findFieldValue(list, names) {
  const wanted = names.map((name) => String(name).toLowerCase());
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || typeof item !== 'object') continue;
    const labels = [
      item.custom_field_name,
      item.custom_field_id,
      item.attribute_name,
      item.attribute_id,
      item.captionRu,
      item.captionEn,
      item.name,
      item.key,
    ].map((value) => String(value || '').toLowerCase());
    if (!labels.some((label) => wanted.includes(label))) continue;
    const value = item.custom_field_value ?? item.attribute_value ?? item.value ?? item.val;
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return null;
}

function findPropertyValue(product, names) {
  const props = product?.properties;
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    const wanted = names.map((name) => String(name).toLowerCase());
    for (const [key, value] of Object.entries(props)) {
      if (!wanted.includes(String(key).toLowerCase())) continue;
      if (value && typeof value === 'object') {
        const nested = value.value ?? value.name ?? null;
        if (nested !== null && nested !== undefined && nested !== '') return String(nested);
      } else if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  }
  return findFieldValue(product?.custom_fields, names) || findFieldValue(product?.product_attributes, names);
}

function normalizeShopStocks(product) {
  const byShop = new Map();
  for (const stock of Array.isArray(product?.shop_measurement_values) ? product.shop_measurement_values : []) {
    const shopId = String(stock.shop_id || '');
    const key = shopId || String(stock.shop_name || byShop.size);
    byShop.set(key, {
      shopId: stock.shop_id || null,
      shopName: stock.shop_name || null,
      stock: Number(stock.active_measurement_value ?? stock.measurement_value ?? 0),
      price: null,
      promoPrice: null,
      currency: null,
    });
  }

  for (const price of Array.isArray(product?.shop_prices) ? product.shop_prices : []) {
    const shopId = String(price.shop_id || '');
    const key = shopId || String(price.shop_name || byShop.size);
    const current = byShop.get(key) || {
      shopId: price.shop_id || null,
      shopName: price.shop_name || null,
      stock: null,
      price: null,
      promoPrice: null,
      currency: null,
    };
    current.price = price.retail_price ?? current.price;
    current.promoPrice = price.promo_price ?? current.promoPrice;
    current.currency = price.retail_currency ?? current.currency;
    current.shopName = current.shopName || price.shop_name || null;
    byShop.set(key, current);
  }

  return Array.from(byShop.values());
}

function normalizeBillzProduct(product) {
  const obj = product && typeof product === 'object' ? product : {};
  const shops = Array.isArray(obj.shops) && obj.shops.length ? obj.shops : normalizeShopStocks(obj);
  const firstPrice = Array.isArray(obj.shop_prices) ? obj.shop_prices[0] : null;
  const firstStock = Array.isArray(obj.shop_measurement_values) ? obj.shop_measurement_values[0] : null;
  const categories = Array.isArray(obj.categories) ? obj.categories.map((item) => item?.name).filter(Boolean) : [];
  const attributes = Array.isArray(obj.product_attributes)
    ? Object.fromEntries(obj.product_attributes.map((item) => [item.attribute_name || item.attribute_id, item.attribute_value]).filter(([key]) => key))
    : {};

  return {
    id: obj.id ?? null,
    name: obj.name ?? null,
    sku: obj.sku ?? obj.vendorCode ?? null,
    vendorCode: obj.sku ?? obj.vendorCode ?? null,
    barcode: obj.barcode ?? obj.barCode ?? null,
    brand: obj.brand ?? obj.brand_name ?? findPropertyValue(obj, ['brand', 'BRAND']),
    model: obj.model ?? findPropertyValue(obj, ['model', 'modelName', 'MODEL', 'Модель']),
    color: obj.color ?? findPropertyValue(obj, ['color', 'colorCode', 'COLOR', 'Цвет']),
    size: obj.size ?? findPropertyValue(obj, ['size', 'SIZE', 'Размер']),
    categories,
    attributes,
    price: Number(firstPrice?.retail_price ?? obj.price ?? 0),
    promoPrice: firstPrice?.promo_price ?? null,
    currency: firstPrice?.retail_currency ?? null,
    stock: Number(firstStock?.active_measurement_value ?? obj.stock ?? obj.qty ?? obj.availableQty ?? 0),
    qty: Number(firstStock?.active_measurement_value ?? obj.stock ?? obj.qty ?? obj.availableQty ?? 0),
    availableQty: Number(firstStock?.active_measurement_value ?? obj.stock ?? obj.qty ?? obj.availableQty ?? 0),
    shops,
    office: firstStock?.shop_name || firstPrice?.shop_name || obj.office || null,
    officeName: firstStock?.shop_name || firstPrice?.shop_name || null,
    officeId: firstStock?.shop_id || firstPrice?.shop_id || null,
    hasPhoto: Boolean(obj.main_image_url || obj.vendorImage || obj.photos?.length),
    updatedAt: obj.updated_at ?? null,
  };
}

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s./_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSizeValue(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const numeric = text.match(/\b(\d{1,3}(?:[.,]\d)?)\b/);
  if (numeric) return numeric[1].replace(',', '.');
  const alpha = text.match(/\b(xs|s|m|l|xl|xxl|xxxl)\b/i);
  return alpha ? alpha[1].toUpperCase() : text;
}

function extractSizeFromText(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const explicit = text.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:eu|eur|размер|разм|р-р|р)\b/);
  if (explicit) return explicit[1].replace(',', '.');
  const beforeWord = text.match(/\b(?:размер|разм|р-р|р)\s*(\d{2}(?:[.,]\d)?)\b/);
  if (beforeWord) return beforeWord[1].replace(',', '.');
  const standalone = text.match(/\b(2[5-9]|3[0-9]|4[0-9]|5[0-2])\b/);
  return standalone ? standalone[1] : '';
}

const COLOR_SYNONYMS = [
  { value: 'black', tokens: ['black', 'bk', 'blk', 'черн', 'черный', 'черная', 'черное', 'черные'] },
  { value: 'white', tokens: ['white', 'wh', 'wht', 'бел', 'белый', 'белая', 'белое', 'белые'] },
  { value: 'red', tokens: ['red', 'rd', 'красн', 'красный', 'красная', 'красное', 'красные'] },
  { value: 'blue', tokens: ['blue', 'blu', 'син', 'синий', 'синяя', 'синие', 'голуб'] },
  { value: 'green', tokens: ['green', 'grn', 'зелен', 'зеленый', 'зеленая', 'зеленые'] },
  { value: 'beige', tokens: ['beige', 'bg', 'беж', 'бежев'] },
  { value: 'brown', tokens: ['brown', 'br', 'корич', 'brown'] },
  { value: 'grey', tokens: ['grey', 'gray', 'gy', 'сер', 'серый', 'серая', 'серые'] },
  { value: 'pink', tokens: ['pink', 'pk', 'роз', 'розовый', 'розовая'] },
  { value: 'yellow', tokens: ['yellow', 'yl', 'желт', 'желтый', 'желтая'] },
];

function detectColor(query) {
  const text = normalizeText(query);
  if (!text) return null;
  const found = COLOR_SYNONYMS.find((color) => color.tokens.some((token) => text.includes(normalizeText(token))));
  return found ? found.value : null;
}

function parseQuery(query) {
  const parsed = parseCustomerQuery(query);
  return {
    size: parsed.size || null,
    color: parsed.color || detectColor(parsed.raw),
    colorHuman: parsed.colorHuman || parsed.color || null,
    colorCode: parsed.colorCode || null,
    colors: parsed.colors || [],
    colorCodes: parsed.colorCodes || [],
    material: parsed.material || null,
    materialCode: parsed.materialCode || null,
    sku: parsed.sku || null,
    barcode: parsed.barcode || null,
    brand: parsed.brand || null,
    excludeBrand: parsed.excludeBrand || null,
    customerType: parsed.customerType || null,
    model: parsed.model || null,
    footLength: parsed.footLength || null,
    sizeRecommendation: parsed.sizeRecommendation || null,
    intent: parsed.intent || detectIntent(parsed.raw),
    raw: parsed.raw,
  };
}

function productSearchHaystack(product) {
  return normalizeText([
    product.name,
    product.sku,
    product.vendorCode,
    product.barcode,
    product.model,
    product.brand,
    product.color,
    product.size,
    ...(Array.isArray(product.categories) ? product.categories : []),
    ...getObjectValues(product.attributes),
  ].filter(Boolean).join(' '));
}

function compactWord(value) {
  return normalizeText(value).replace(/[aeiouауоыиэяюе]/g, '');
}

function haystackIncludesToken(haystack, token) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) return false;
  if (haystack.includes(normalizedToken)) return true;
  const compactToken = compactWord(normalizedToken);
  if (compactToken.length < 3) return false;
  return haystack.split(' ').some((word) => compactWord(word) === compactToken);
}

function productMatchesColor(product, parsedColor) {
  if (!parsedColor) return true;
  const colorMeta = COLOR_SYNONYMS.find((item) => item.value === parsedColor);
  const text = normalizeText([product.color, product.name, product.model].filter(Boolean).join(' '));
  return Boolean(colorMeta?.tokens.some((token) => text.includes(normalizeText(token))));
}

function productMatchesSize(product, parsedSize) {
  if (!parsedSize) return true;
  const wanted = normalizeSizeValue(parsedSize);
  const direct = normalizeSizeValue(product.size);
  if (direct && direct === wanted) return true;
  return extractSizeFromText(product.name) === wanted || extractSizeFromText(product.model) === wanted;
}

function scoreProduct(product, parsed) {
  const productMeta = parseBillzProduct(product);
  if (parsed.sku && normalizeText(product.sku || product.vendorCode || productMeta.sku) !== normalizeText(parsed.sku)) return 0;
  if (parsed.barcode && String(product.barcode || '') !== String(parsed.barcode)) return 0;
  if (!productMatchesSize(product, parsed.size)) return 0;
  const wantedColorCodes = Array.isArray(parsed.colorCodes) && parsed.colorCodes.length ? parsed.colorCodes : (parsed.colorCode ? [parsed.colorCode] : []);
  const wantedColorNames = Array.isArray(parsed.colors) && parsed.colors.length ? parsed.colors.map((item) => item.human) : (parsed.color ? [parsed.color] : []);
  const colorMatches = !wantedColorCodes.length || wantedColorCodes.includes(productMeta.color?.code) || wantedColorNames.some((color) => normalizeText(productMeta.color?.name) === normalizeText(color) || productMatchesColor(product, color));
  if (!colorMatches) return 0;
  const productMaterialCode = productMeta.material?.code || String(product.name || '').match(/\b(01|02|03|04)\b/)?.[1] || null;
  const materialMatches = !parsed.material || productMaterialCode === parsed.materialCode || normalizeText(productMeta.material?.name).includes(normalizeText(parsed.material));
  if (!materialMatches) return 0;
  if (parsed.excludeBrand && normalizeText(productMeta.brand?.name) === normalizeText(parsed.excludeBrand)) return 0;
  if (parsed.brand && !normalizeText(productMeta.brand?.name).includes(normalizeText(parsed.brand))) return 0;
  if (parsed.model && productMeta.model && !normalizeText(productMeta.model).includes(normalizeText(parsed.model)) && !productSearchHaystack(product).includes(normalizeText(parsed.model))) return 0;

  const haystack = productSearchHaystack(product);
  let score = 0;
  if (parsed.size) score += 80;
  if (parsed.color) score += 40;
  if (parsed.material) score += 35;
  if (parsed.brand) score += 35;
  if (parsed.model) score += 15;
  if (parsed.sku) score += 120;
  if (parsed.barcode) score += 120;
  if (parsed.brand && haystackIncludesToken(haystack, parsed.brand)) score += 25;

  const usefulTokens = normalizeText(parsed.raw)
    .split(' ')
    .filter((token) => token.length >= 3 && !['есть', 'какие', 'какой', 'какая', 'модели', 'модель', 'размер', 'размером'].includes(token));
  for (const token of usefulTokens) {
    if (haystackIncludesToken(haystack, token)) score += 5;
  }

  if (!parsed.size && !parsed.color && !parsed.material && !parsed.sku && !parsed.barcode && !parsed.brand && !parsed.model) {
    score = usefulTokens.some((token) => haystackIncludesToken(haystack, token)) ? score || 1 : 0;
  }

  return score;
}

function searchProductsLocal(products, query, limit = 5) {
  const parsedQuery = typeof query === 'object' && query !== null ? query : parseQuery(query);
  const normalizedProducts = (Array.isArray(products) ? products : []).map(normalizeBillzProduct);
  const productIndex = buildProductIndex(normalizedProducts);
  const advancedResult = searchProductsAdvanced(productIndex, parsedQuery.raw || query, {
    limit,
    memory: parsedQuery.memory || {},
  });
  if (advancedResult.ok && (advancedResult.products.length || advancedResult.recommendations.length || advancedResult.query.intent === 'brand_list')) {
    const products = advancedResult.products.slice(0, Math.max(1, Number(limit) || 5));
    return {
      parsedQuery: { ...parsedQuery, ...advancedResult.query },
      products,
      docs: advancedResult.docs,
      recommendations: advancedResult.recommendations,
      recommendationReasoning: advancedResult.recommendationReasoning,
      searchMode: advancedResult.mode,
      searchSummary: advancedResult.searchSummary,
      brandSummary: buildBrandSummary(productIndex),
      totalCachedProducts: normalizedProducts.length,
      matchedProducts: products.length,
    };
  }
  const indexed = searchProductIndex(productIndex, parsedQuery, parsedQuery.raw || '', limit);
  logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
    stage: 'local-search:start',
    parsedQuery,
    totalProductsInCache: normalizedProducts.length,
    normalizedQuery: indexed.normalizedQuery,
  });

  const result = {
    ok: true,
    parsedQuery,
    normalizedQuery: indexed.normalizedQuery,
    totalCachedProducts: normalizedProducts.length,
    matchedProducts: indexed.finalMatches,
    products: indexed.products,
    brandSummary: buildBrandSummary(productIndex),
    searchSummary: {
      modelConfidence: indexed.modelConfidence,
      strictMatches: indexed.strictMatches,
      softMatches: indexed.softMatches,
      finalMatches: indexed.finalMatches,
      topScores: indexed.topScores,
    },
  };
  logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
    stage: 'local-search:done',
    detectedColorHuman: parsedQuery.colorHuman || parsedQuery.color || null,
    detectedColorCode: parsedQuery.colorCode || null,
    detectedColorCodes: parsedQuery.colorCodes || [],
    excludeBrand: parsedQuery.excludeBrand || null,
    detectedMaterial: parsedQuery.material || null,
    detectedMaterialCode: parsedQuery.materialCode || null,
    matchedProductsCount: result.matchedProducts,
    strictMatches: indexed.strictMatches,
    softMatches: indexed.softMatches,
    finalMatches: indexed.finalMatches,
    topScores: indexed.topScores,
    matchedProductsPreview: result.products.slice(0, 3).map((product) => ({
      name: product.name,
      color: product.color,
      size: product.size,
      price: product.price,
    })),
  });
  return result;
}

function buildProductSample(products, limit = 5) {
  return products.slice(0, limit).map(normalizeBillzProduct);
}

function formatBranchAddress(branch) {
  if (!branch?.address) return '';
  return branch.note ? `${branch.address}\n(${branch.note})` : branch.address;
}

function findStoreInText(value) {
  const text = normalizeText(value);
  if (!text) return null;
  for (const [id, store] of Object.entries(STORES)) {
    const code = normalizeText(id);
    if (text === code || text.includes(` ${code} `) || store.patterns?.some((pattern) => text.includes(normalizeText(pattern)))) {
      return { id, ...store, formatted: formatBranchAddress(store) };
    }
  }
  return null;
}

function collectRawStoreFields(product) {
  const normalized = normalizeBillzProduct(product);
  const rawFields = {
    office: product?.office ?? product?.officeName ?? normalized.office ?? normalized.officeName ?? null,
    sku: product?.sku ?? product?.vendorCode ?? normalized.sku ?? null,
    barcode: product?.barcode ?? product?.barCode ?? normalized.barcode ?? null,
    name: product?.name ?? normalized.name ?? null,
    shops: Array.isArray(product?.shops) ? product.shops : normalized.shops,
    shop_measurement_values: Array.isArray(product?.shop_measurement_values) ? product.shop_measurement_values : [],
    shop_prices: Array.isArray(product?.shop_prices) ? product.shop_prices : [],
    store: product?.store ?? product?.store_name ?? null,
    warehouse: product?.warehouse ?? product?.warehouse_name ?? null,
    metadata: product?.metadata ?? product?.meta ?? null,
  };
  return rawFields;
}

function detectStoreAddress(product) {
  const parsedStore = parseProductStore(product);
  const rawStoreFields = collectRawStoreFields(product);
  if (parsedStore && !parsedStore.lowConfidence) {
    return {
      office: rawStoreFields.office,
      sku: rawStoreFields.sku,
      rawStoreFields,
      detectedStore: parsedStore.name,
      detectedAddress: parsedStore.formatted,
      branch: {
        name: parsedStore.name,
        address: parsedStore.address,
        note: parsedStore.note,
        formatted: parsedStore.formatted,
      },
    };
  }
  const candidates = [
    rawStoreFields.name,
    rawStoreFields.sku,
    rawStoreFields.barcode,
    rawStoreFields.store,
    rawStoreFields.warehouse,
    ...getObjectValues(rawStoreFields.metadata),
  ];

  for (const shop of Array.isArray(rawStoreFields.shops) ? rawStoreFields.shops : []) {
    if (Number(shop.stock ?? shop.active_measurement_value ?? shop.measurement_value ?? 0) <= 0) continue;
    candidates.push(shop.shopName, shop.shop_name, shop.name, shop.title, shop.address, shop.warehouse_name, shop.store_name);
  }

  for (const stock of Array.isArray(rawStoreFields.shop_measurement_values) ? rawStoreFields.shop_measurement_values : []) {
    if (Number(stock.active_measurement_value ?? stock.measurement_value ?? 0) <= 0) continue;
    candidates.push(stock.shop_name, stock.shop_id, stock.store_name, stock.warehouse_name, stock.address);
  }

  for (const price of Array.isArray(rawStoreFields.shop_prices) ? rawStoreFields.shop_prices : []) {
    candidates.push(price.shop_name, price.shop_id, price.store_name, price.warehouse_name, price.address);
  }

  const store = candidates.map(findStoreInText).find(Boolean) || null;
  return {
    office: rawStoreFields.office,
    sku: rawStoreFields.sku,
    rawStoreFields,
    detectedStore: store?.name || null,
    detectedAddress: store?.formatted || null,
    branch: store ? {
      name: store.name,
      address: store.address,
      note: store.note,
      formatted: store.formatted,
    } : null,
  };
}

function getProductBranches(product) {
  const branches = new Map();
  const detected = detectStoreAddress(product);
  if (detected.branch) branches.set(detected.branch.address, detected.branch);
  return Array.from(branches.values());
}

function getProductStoreDebug(product) {
  const detected = detectStoreAddress(product);
  return {
    office: detected.office,
    sku: detected.sku,
    rawStoreFields: detected.rawStoreFields,
    detectedStore: detected.detectedStore,
    detectedAddress: detected.detectedAddress,
  };
}

function colorToPlural(color) {
  const value = String(color || '').trim();
  const forms = {
    'черный': 'черные',
    'белый': 'белые',
    'бежевый': 'бежевые',
    'коричневый': 'коричневые',
    'зеленый': 'зеленые',
    'светло-зеленый': 'светло-зеленые',
    'светло-серый': 'светло-серые',
    'серый': 'серые',
    'синий': 'синие',
    'темно-синий': 'темно-синие',
    'бордовый': 'бордовые',
    'розовый': 'розовые',
    'красный': 'красные',
    'желтый': 'желтые',
    'оранжевый': 'оранжевые',
  };
  return forms[value] || value;
}

function normalizeColorCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return COLOR_MAP[code] ? code : '';
}

function detectHumanColor(product) {
  const normalized = normalizeBillzProduct(product);
  const candidates = [];
  if (normalized.color) candidates.push(normalized.color);
  if (normalized.sku) candidates.push(normalized.sku);
  if (normalized.vendorCode) candidates.push(normalized.vendorCode);
  if (normalized.name) {
    candidates.push(normalized.name);
    String(normalized.name).split('/').forEach((segment) => candidates.push(segment));
  }
  if (normalized.model) candidates.push(normalized.model);

  for (const candidate of candidates) {
    const direct = normalizeColorCode(candidate);
    if (direct) return { rawColorCode: direct, detectedColor: COLOR_MAP[direct], displayColor: colorToPlural(COLOR_MAP[direct]) };

    const tokens = String(candidate || '').match(/\b[A-Z]{2}\b/g) || [];
    for (const token of tokens.reverse()) {
      const code = normalizeColorCode(token);
      if (code) return { rawColorCode: code, detectedColor: COLOR_MAP[code], displayColor: colorToPlural(COLOR_MAP[code]) };
    }
  }

  const haystack = normalizeText([normalized.color, normalized.name, normalized.model].filter(Boolean).join(' '));
  const knownNames = Object.values(COLOR_MAP);
  const foundName = knownNames.find((color) => haystack.includes(normalizeText(color)));
  if (foundName) return { rawColorCode: null, detectedColor: foundName, displayColor: colorToPlural(foundName) };

  return { rawColorCode: null, detectedColor: null, displayColor: null };
}

function getHumanProductName(product, colorInfo) {
  if (product?.model && !normalizeColorCode(product.model)) return String(product.model).trim();
  const firstSegment = String(product?.name || '').split('/')[0] || '';
  const colorCodePattern = Object.keys(COLOR_MAP).join('|');
  const cleaned = firstSegment
    .replace(/\b[A-ZА-Я]{2,}\d{2,}[A-ZА-Я0-9-]*\b/gi, ' ')
    .replace(new RegExp(`\\b(${colorCodePattern})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b${String(colorInfo?.rawColorCode || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function getPriceRange(products) {
  const prices = (Array.isArray(products) ? products : [])
    .map((product) => Number(product?.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    min,
    max,
    text: min === max ? `${min} сом` : `от ${min} до ${max} сом`,
  };
}

function humanizeBillzProducts(products, options = {}) {
  const normalized = (Array.isArray(products) ? products : [])
    .map(normalizeBillzProduct)
    .filter((product) => Number(product.stock ?? product.qty ?? product.availableQty ?? 0) > 0);
  const visibleProducts = normalized.slice(0, Math.max(1, Number(options.limit) || 5)).map((product) => {
    const branches = getProductBranches(product);
    const parsedProduct = parseBillzProduct(product);
    const colorInfo = detectHumanColor(product);
    const human = humanizeBillzProduct(product);
    const humanProduct = {
      label: parsedProduct.color?.display || colorInfo.displayColor || (product.size ? `модель ${product.size} размера` : 'модель'),
      title: human.title,
      name: human.title,
      model: parsedProduct.model,
      brand: parsedProduct.brand?.name || null,
      material: parsedProduct.material?.name || null,
      description: human.description,
      size: parsedProduct.size || (product.size ? String(product.size) : null),
      color: parsedProduct.color?.name || colorInfo.detectedColor,
      displayColor: parsedProduct.color?.display || colorInfo.displayColor,
      price: human.price,
      branches: branches.map((branch) => ({ name: branch.name, address: branch.address, note: branch.note, formatted: branch.formatted })),
      addresses: branches.map((branch) => branch.formatted),
      images: [],
    };
    if (options.includeDebug) {
      humanProduct.colorDebug = {
        rawColorCode: parsedProduct.color?.code || colorInfo.rawColorCode,
        detectedColor: parsedProduct.color?.name || colorInfo.detectedColor,
      };
      humanProduct.storeDebug = getProductStoreDebug(product);
      humanProduct.parserDebug = parsedProduct;
    }
    return humanProduct;
  });
  const addressSet = new Set();
  const branchMap = new Map();
  visibleProducts.forEach((product) => {
    product.addresses.forEach((address) => addressSet.add(address));
    product.branches.forEach((branch) => branchMap.set(branch.address, branch));
  });
  return {
    available: visibleProducts.length > 0,
    count: visibleProducts.length,
    priceRange: getPriceRange(visibleProducts),
    branches: Array.from(branchMap.values()),
    addresses: Array.from(addressSet),
    products: visibleProducts,
    styleRules: [
      'Не показывать SKU, артикулы, barcode, stock count, office codes и JSON.',
      'Не говорить слово "остаток".',
      'Использовать только реальные адреса из addresses/branches и не добавлять второй филиал, если его нет в context.',
      'Если указан displayColor, описывать товар человеческим цветом: бежевые, черные, зеленые.',
      'Использовать дружелюбный WhatsApp-стиль и умеренно добавлять 💛, 🙌, 👌 или 😊.',
      'Если модель не уточнена, подтвердить наличие кратко, назвать диапазон цен и предложить подобрать фото/модели.',
      'Если модель уточнена, можно назвать модель, размер, цену и адреса.',
    ],
  };
}

function sampleFieldsFromProduct(product) {
  const normalized = normalizeBillzProduct(product);
  return {
    name: normalized.name,
    sku: normalized.sku,
    barcode: normalized.barcode,
    price: normalized.price,
    stock: normalized.stock,
    office: normalized.office,
    size: normalized.size,
    color: normalized.color,
    model: normalized.model,
  };
}

function buildMethodResult(method, result) {
  const products = result.products || extractProducts(result.data);
  const hasData = result.ok && products.length > 0;
  const error = result.error || {};
  return {
    method,
    endpoint: result.request ? `${result.request.method} ${new URL(result.request.url).pathname}` : method,
    params: result.request?.query || {},
    status: result.status,
    code: result.code,
    result: result.ok ? 'success' : (result.result || error.message || result.code || 'error'),
    errorCode: error.code || '',
    errorMessage: result.errorMessage || error.message || '',
    errorData: result.errorData ?? error.data ?? null,
    count: result.ok ? (result.count ?? products.length) : 0,
    sampleKeys: hasData ? Object.keys(products[0]).slice(0, 12) : [],
    sampleFields: hasData ? sampleFieldsFromProduct(products[0]) : {},
    sample: hasData ? buildProductSample(products, 5) : null,
  };
}

async function checkConnection(secretToken) {
  try {
    await auth(secretToken, { force: true });
    return { ok: true, connected: true, status: 'connected' };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      status: 'error',
      error: error.code || normalizeBillzError(error, error.status),
      statusCode: error.status || 0,
      errorMessage: error.message || '',
      errorData: error.data ?? null,
    };
  }
}

async function runDiagnostics(secretToken) {
  logBillz('request', 'diagnostics start', { baseUrl: getBillzAdminBaseUrl(), methods: DIAGNOSTIC_METHODS });
  const connection = await checkConnection(secretToken);
  if (!connection.ok) {
    logBillz('error', 'diagnostics auth failed', {
      error: connection.error,
      message: connection.errorMessage,
      data: connection.errorData ?? null,
    });
    return {
      ok: false,
      status: 'error',
      error: connection.error,
      errorMessage: connection.errorMessage || '',
      errorData: connection.errorData ?? null,
      checkedAt: new Date().toISOString(),
      endpoints: [],
    };
  }

  const endpoints = [];
  const productsResult = await getProducts(secretToken, { page: 1, limit: 5 });
  endpoints.push(buildMethodResult('GET /v2/products', productsResult));

  const firstProduct = productsResult.products?.[0] || null;
  const searchTerm = firstProduct?.sku || firstProduct?.barcode || firstProduct?.name || '';
  const searchResult = searchTerm
    ? await searchCatalog(secretToken, searchTerm, 1, 5)
    : { ...productsResult, request: { ...productsResult.request, query: { limit: 5, page: 1, search: '' } } };
  endpoints.push(buildMethodResult('GET /v2/products?search', searchResult));

  return {
    ok: endpoints.some((item) => item.status >= 200 && item.status < 300),
    status: 'connected',
    checkedAt: new Date().toISOString(),
    apiBaseUrl: getBillzAdminBaseUrl(),
    endpoints,
  };
}

function compactProductContext(source, limit = 5) {
  if (Array.isArray(source)) return source.slice(0, limit).map(normalizeBillzProduct);
  const diagnosticsProducts = source?.endpoints?.flatMap((item) => Array.isArray(item.sample) ? item.sample : []) || [];
  return diagnosticsProducts.slice(0, limit).map(normalizeBillzProduct);
}

async function fetchBillzCatalog(authOptions = {}, options = {}) {
  const secretToken = String(authOptions.secretToken || '').trim();
  const limit = clampLimit(options.limit || 5);
  const result = await getProducts(secretToken, { page: 1, limit });
  if (!result.ok) {
    return { ok: false, catalog: [], error: result.code || 'unknown', diagnostics: null };
  }
  return { ok: true, catalog: result.products.slice(0, limit).map(normalizeBillzProduct), diagnostics: null, error: '' };
}

async function testBillzSecretToken(authOptions = {}) {
  return checkConnection(authOptions.secretToken);
}

async function getBillzContextForAi(secretToken, query, options = {}) {
  const cleanQuery = String(query || '').trim();
  const result = await searchProductsHybrid(secretToken, cleanQuery, 5, { memory: options.memory || {} });
  if (!result.ok) {
    return {
      connected: false,
      ok: false,
      query: cleanQuery,
      error: result.code || result.errorMessage || 'billz-error',
      errorMessage: result.errorMessage || '',
      products: [],
      parsedQuery: result.parsedQuery || parseQuery(cleanQuery),
      detectedIntent: detectIntent(cleanQuery),
      brandSummary: result.brandSummary || { brandsAvailable: [] },
      searchSummary: result.searchSummary || null,
      recommendations: [],
      recommendationReasoning: [],
      totalCachedProducts: result.totalCachedProducts || 0,
      matchedProducts: 0,
      searchMode: result.searchMode || 'local',
      updatedAt: new Date().toISOString(),
    };
  }

  const products = result.products.slice(0, 5).map((product) => {
    const normalized = normalizeBillzProduct(product);
    return {
      name: normalized.name,
      sku: normalized.sku,
      barcode: normalized.barcode,
      price: normalized.price,
      stock: normalized.stock,
      qty: normalized.qty,
      availableQty: normalized.availableQty,
      office: normalized.office,
      officeName: normalized.officeName,
      officeId: normalized.officeId,
      shops: normalized.shops,
      size: normalized.size,
      color: normalized.color,
      model: normalized.model,
    };
  });
  logger.info(LOG_CATEGORIES.SEARCH, 'AI search', {
    stage: 'ai-context:built',
    userQuery: cleanQuery,
    aiContextProductsCount: products.length,
    matchedProductsCount: result.matchedProducts ?? result.count ?? products.length,
    totalProductsInCache: result.totalCachedProducts || 0,
  });

  return {
    connected: true,
    ok: true,
    query: cleanQuery,
    products,
    parsedQuery: result.parsedQuery || parseQuery(cleanQuery),
    detectedIntent: result.parsedQuery?.intent || detectIntent(cleanQuery),
    sizeRecommendation: result.parsedQuery?.sizeRecommendation || null,
    humanizedProducts: humanizeBillzProducts(products, { limit: 5 }),
    brandSummary: result.brandSummary || { brandsAvailable: [] },
    searchSummary: result.searchSummary || null,
    recommendations: (result.recommendations || []).slice(0, 5).map((item) => normalizeBillzProduct(item.product || item)),
    recommendationReasoning: result.recommendationReasoning || [],
    searchDebug: {
      userQuery: cleanQuery,
      normalizedQuery: result.normalizedQuery || normalizeSearchText(cleanQuery),
      parsedQuery: result.parsedQuery || parseQuery(cleanQuery),
      detectedIntent: result.parsedQuery?.intent || detectIntent(cleanQuery),
      detectedColorHuman: result.parsedQuery?.colorHuman || result.parsedQuery?.color || null,
      detectedColorCode: result.parsedQuery?.colorCode || null,
      totalProductsInCache: result.totalCachedProducts || 0,
      strictMatches: result.searchSummary?.strictMatches ?? 0,
      softMatches: result.searchSummary?.softMatches ?? 0,
      finalMatches: result.searchSummary?.finalMatches ?? (result.matchedProducts ?? result.count ?? products.length),
      topScores: result.searchSummary?.topScores || [],
      fallbackUsed: Boolean(result.searchSummary?.fallbackUsed),
      recommendationReasoning: result.recommendationReasoning || [],
      matchedProductsCount: result.matchedProducts ?? result.count ?? products.length,
      matchedProductsPreview: products.slice(0, 3).map((product) => ({
        name: product.name,
        color: product.color,
        size: product.size,
        price: product.price,
      })),
    },
    totalCachedProducts: result.totalCachedProducts || 0,
    matchedProducts: result.matchedProducts ?? result.count ?? products.length,
    searchMode: result.searchMode || 'local',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeRpcError(error) {
  if (!error || typeof error !== 'object') {
    return { code: 'rpc-error', message: String(error || 'RPC error'), data: null };
  }
  return { code: error.code ?? 'rpc-error', message: String(error.message || 'RPC error'), data: error.data ?? null };
}

function normalizeRpcParams(params) {
  if (params === undefined || params === null) return {};
  if (Array.isArray(params) || typeof params !== 'object') {
    const error = new Error('BILLZ JSON-RPC params must be an object');
    error.code = 'invalid-params';
    throw error;
  }
  return params;
}

async function jsonRpcRequest({ baseUrl, method, params }, options = {}) {
  const methodName = String(method || '').trim();
  if (!methodName) {
    const error = new Error('BILLZ RPC method is empty');
    error.code = 'missing-method';
    throw error;
  }

  const url = normalizeBaseUrl(baseUrl, '');
  if (!url) {
    const error = new Error('BILLZ RPC baseUrl is empty');
    error.code = 'missing-base-url';
    throw error;
  }

  const secretToken = String(options.secretToken || '').trim();
  const authResult = await auth(secretToken, options);
  const rpcParams = normalizeRpcParams(params);
  const requestBody = {
    jsonrpc: '2.0',
    method: methodName,
    params: rpcParams,
    id: options.id || String(rpcRequestId++),
  };

  logBillz('request', `JSON-RPC ${methodName}`, { baseUrl: url, body: previewJson(requestBody, 3000) });
  const { response, data } = await fetchJson(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authResult.accessToken}`,
      ...(options.headers || {}),
    },
    body: requestBody,
  });
  logBillz('response', `JSON-RPC ${methodName}`, { baseUrl: url, status: response.status, body: previewJson(data, 3000) });

  if (data?.error) {
    const rpcError = normalizeRpcError(data.error);
    logBillz('error', `JSON-RPC ${methodName}`, { code: rpcError.code, message: rpcError.message, data: rpcError.data });
    return {
      ok: false,
      status: response.status,
      code: String(rpcError.code || 'rpc-error'),
      result: rpcError.message,
      errorMessage: rpcError.message,
      errorData: rpcError.data,
      error: rpcError,
      data: null,
      raw: data,
      params: rpcParams,
      baseUrl: url,
    };
  }

  if (!response.ok) {
    const apiError = normalizeApiErrorPayload(data, response);
    return {
      ok: false,
      status: response.status,
      code: normalizeBillzError(apiError.message, response.status),
      result: apiError.message,
      errorMessage: apiError.message,
      errorData: apiError.data,
      data: null,
      raw: data,
      params: rpcParams,
      baseUrl: url,
    };
  }

  return {
    ok: true,
    status: response.status,
    code: 'ok',
    result: 'success',
    data: data?.result,
    raw: data,
    params: rpcParams,
    baseUrl: url,
  };
}

async function request(method, options = {}) {
  return jsonRpcRequest({ baseUrl: options.baseUrl || getBillzApiV1BaseUrl(), method, params: options.params || {} }, options);
}

module.exports = {
  auth,
  jsonRpcRequest,
  request,
  restRequest,
  checkConnection,
  runDiagnostics,
  getProducts,
  searchProducts,
  searchProductsHybrid,
  searchProductsLocal,
  parseQuery,
  detectHumanColor,
  detectStoreAddress,
  getCatalog,
  getCatalogPage,
  searchCatalog,
  normalizeBillzProduct,
  humanizeBillzProducts,
  getBillzContextForAi,
  fetchBillzCatalog,
  testBillzSecretToken,
  getBillzAuthBaseUrl,
  getBillzAdminBaseUrl,
  getBillzApiV1BaseUrl,
  getBillzApiV2BaseUrl,
  normalizeBillzError,
  compactProductContext,
  extractProducts,
  DIAGNOSTIC_METHODS,
};
