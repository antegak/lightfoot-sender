require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { WhatsAppController } = require('./whatsapp');
const NameUtils = require('./name-utils');
const { parseCustomerQuery } = require('./intent-detector');
const {
  LOG_CATEGORIES,
  clearLogs,
  getLogDirectory,
  logger,
  readRecentLogs,
} = require('./services/logger/logger');
const { buildDiagnostics } = require('./services/diagnostics');
const { ConversationMemory } = require('./services/memory');
const { buildAiContext } = require('./services/ai/context-builder');
const {
  buildConversationContext,
  buildCustomerProfile,
  buildReasoningObject,
  buildReasoningUserPrompt,
  parseReasoningObject,
} = require('./services/ai/response-contract');
const { formatHumanResponse, humanizeBranches } = require('./services/humanizer');
const { applyDialoguePolicy, applyRecommendationProgression, buildConversationState } = require('./services/conversation');
const { buildResponsePlan } = require('./services/orchestration');
const { buildLightfootConsultantReasoningPrompt } = require('./services/ai/prompts/lightfoot-consultant');
const { buildProductGallery } = require('./services/product-media');
const { runQaFixtures } = require('./services/qa');
const {
  checkConnection: checkBillzConnection,
  compactProductContext,
  DIAGNOSTIC_METHODS,
  getBillzAdminBaseUrl,
  getBillzContextForAi,
  humanizeBillzProducts,
  normalizeBillzError,
  runDiagnostics: runBillzDiagnostics,
  searchCatalog: searchBillzCatalog,
} = require('./billz-client');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (error) {
  logger.warn(LOG_CATEGORIES.SYSTEM, 'electron-updater is not available', { error: error?.message || error });
}

process.on('uncaughtException', (error) => {
  logger.error(LOG_CATEGORIES.ERROR, 'uncaught exception', { error });
});

process.on('unhandledRejection', (reason) => {
  logger.error(LOG_CATEGORIES.ERROR, 'unhandled promise rejection', { reason });
});

let mainWindow;
const accountControllers = new Map();
let pendingUpdateInfo = null;
let updateDownloaded = false;
let updaterListenersReady = false;
let updateFlowState = 'idle';

const USER_DATA = app.getPath('userData');
const DATA_DIR = path.join(USER_DATA, 'data');
const BASE_BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const BASES_FILE = path.join(DATA_DIR, 'bases.json');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const LEGACY_BASES_FILE = path.join(USER_DATA, 'bases.json');
const ACCOUNTS_FILE = path.join(USER_DATA, 'accounts.json');
const MESSAGES_FILE = path.join(USER_DATA, 'messages.json');
const AI_MEMORY_FILE = path.join(DATA_DIR, 'ai-memory.json');
const BILLZ_DIAGNOSTICS_FILE = path.join(DATA_DIR, 'billz-diagnostics.json');
const COLLECT_PROGRESS_FILE = path.join(DATA_DIR, 'collect-progress.json');
const GLOBAL_SEND_HISTORY_FILE = path.join(DATA_DIR, 'send-history.json');
const MESSAGE_IMAGES_DIR = path.join(DATA_DIR, 'message-images');
const LEGACY_HISTORY_FILE = path.join(USER_DATA, 'send_history.json');
const LEGACY_LOGS_FILE = path.join(USER_DATA, 'logs.txt');
const LEGACY_SESSION_DIR = path.join(USER_DATA, 'wa_session');
const ACCOUNT_IDS = ['wa_1', 'wa_2', 'wa_3'];
const ACCOUNT_STATUS_VALUES = new Set(['offline', 'connected', 'qr', 'loading', 'error']);

logger.info(LOG_CATEGORIES.AI, 'OpenRouter env key status', {
  loaded: Boolean(process.env.OPENROUTER_API_KEY),
});

const LEGACY_CONTACTS_FILE = path.join(USER_DATA, 'contacts.json');
const LEGACY_MAIN_CONTACTS_FILE = path.join(USER_DATA, 'contacts_main.json');
const LEGACY_NEW_CONTACTS_FILE = path.join(USER_DATA, 'contacts_new.json');
const pendingImports = new Map();
let lastBillzDiagnostics = null;
let lastAiDebugState = null;
let aiSandboxHistory = [];
const aiConversationMemory = new ConversationMemory();
let aiSandboxMemory = {
  currentBrand: null,
  currentColor: null,
  currentSize: null,
  currentMaterial: null,
  currentIntent: null,
  customerType: null,
  footLength: null,
  childAgeGroup: null,
};

function updateAiSandboxMemory(parsedQuery = {}) {
  if (parsedQuery.brand) aiSandboxMemory.currentBrand = parsedQuery.brand;
  if (parsedQuery.colorHuman || parsedQuery.color) aiSandboxMemory.currentColor = parsedQuery.colorHuman || parsedQuery.color;
  if (parsedQuery.size) aiSandboxMemory.currentSize = parsedQuery.size;
  if (parsedQuery.material) aiSandboxMemory.currentMaterial = parsedQuery.material;
  if (parsedQuery.intent) aiSandboxMemory.currentIntent = parsedQuery.intent;
  if (parsedQuery.footLength) aiSandboxMemory.footLength = parsedQuery.footLength;
  return aiSandboxMemory;
}

function syncAiSandboxMemoryFromConversation() {
  const entities = aiConversationMemory.getState().entities || {};
  if (entities.preferredBrand) aiSandboxMemory.currentBrand = entities.preferredBrand;
  if (entities.preferredColor) aiSandboxMemory.currentColor = entities.preferredColor;
  if (entities.preferredSize) aiSandboxMemory.currentSize = entities.preferredSize;
  if (entities.preferredMaterial) aiSandboxMemory.currentMaterial = entities.preferredMaterial;
  if (entities.lastIntent) aiSandboxMemory.currentIntent = entities.lastIntent;
  if (entities.footLength) aiSandboxMemory.footLength = entities.footLength;
  if (entities.childAge) aiSandboxMemory.childAgeGroup = entities.childAge;
  return aiSandboxMemory;
}

function mergeMemoryIntoText(text) {
  const base = String(text || '').trim();
  const parts = [base];
  const lower = base.toLocaleLowerCase('ru-RU');
  if (aiSandboxMemory.currentColor && !lower.includes(aiSandboxMemory.currentColor)) parts.push(aiSandboxMemory.currentColor);
  if (aiSandboxMemory.currentSize && !new RegExp(`\\b${aiSandboxMemory.currentSize}\\b`).test(base)) parts.push(`${aiSandboxMemory.currentSize} размер`);
  if (aiSandboxMemory.currentMaterial && !lower.includes(aiSandboxMemory.currentMaterial)) parts.push(aiSandboxMemory.currentMaterial);
  if (aiSandboxMemory.currentBrand && !lower.includes(aiSandboxMemory.currentBrand.toLocaleLowerCase('ru-RU'))) parts.push(aiSandboxMemory.currentBrand);
  return parts.filter(Boolean).join(' ');
}

function ensureCustomerAddresses(text) {
  const value = String(text || '').trim();
  const branches = humanizeBranches();
  if (!value) return branches;
  if (value.includes('Коенкозова') && value.includes('Байтик Баатыра')) return value;
  return [value, branches].filter(Boolean).join('\n\n');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readAppConfig() {
  const config = safeReadJson(CONFIG_FILE, {});
  return config && typeof config === 'object' ? config : {};
}

function writeAppConfig(config) {
  safeWriteJson(CONFIG_FILE, config && typeof config === 'object' ? config : {});
}

function readProjectJson(relativePath, fallback) {
  const filePath = path.join(__dirname, relativePath);
  return safeReadJson(filePath, fallback);
}

function getFeatureFlags() {
  return readProjectJson('config/feature-flags.json', {});
}

function getOpenRouterApiKey() {
  const configKey = String(readAppConfig().openrouterApiKey || '').trim();
  if (configKey) return configKey;
  return String(process.env.OPENROUTER_API_KEY || '').trim();
}

function hasOpenRouterApiKey() {
  const key = getOpenRouterApiKey();
  return Boolean(key) && !key.includes('ВСТАВЬ_КЛЮЧ_СЮДА') && !key.includes('КЛЮЧ');
}

function getBillzAuthConfig() {
  const config = readAppConfig();
  return {
    secretToken: String(config.billzSecretToken || '').trim(),
    apiBaseUrl: getBillzAdminBaseUrl(),
  };
}

function maskBillzSecret(secretToken) {
  const value = String(secretToken || '').trim();
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}...****`;
  const prefix = value.startsWith('secret') ? 'secret' : value.slice(0, 2);
  return `${prefix}...****`;
}

function getBillzStatus() {
  const config = readAppConfig();
  const authConfig = getBillzAuthConfig();
  const hasKey = Boolean(authConfig.secretToken);
  const diagnostics = lastBillzDiagnostics || safeReadJson(BILLZ_DIAGNOSTICS_FILE, null);
  const productsReady = Boolean(diagnostics?.endpoints?.some((item) => item.method === 'GET /v2/products' && item.status === 200));
  return {
    ok: true,
    connected: hasKey && config.billzStatus === 'connected',
    status: hasKey ? (config.billzStatus || 'disconnected') : 'disconnected',
    hasKey,
    maskedSecret: hasKey ? maskBillzSecret(authConfig.secretToken) : '',
    apiBaseUrl: authConfig.apiBaseUrl,
    lastCheckedAt: config.billzLastCheckedAt || '',
    error: config.billzError || '',
    productsReady,
    diagnosticsCheckedAt: diagnostics?.checkedAt || '',
  };
}

function saveBillzState(patch = {}) {
  const config = readAppConfig();
  Object.assign(config, patch, { billzLastCheckedAt: new Date().toISOString() });
  writeAppConfig(config);
  return getBillzStatus();
}

async function saveBillzSecretToken(payload = {}) {
  const config = readAppConfig();
  const incomingSecret = typeof payload === 'string' ? payload : (payload?.secretToken || payload?.key || '');
  const secretToken = String(incomingSecret || config.billzSecretToken || '').trim();
  if (!secretToken) return { ok: false, error: 'missing-secret', status: 'disconnected' };

  config.billzSecretToken = secretToken;
  delete config.billzApiBaseUrl;
  delete config.billzApiKey;
  delete config.billzUsername;
  delete config.billzIssuer;
  delete config.billzMode;
  config.billzStatus = 'disconnected';
  config.billzError = '';
  config.billzLastCheckedAt = new Date().toISOString();
  writeAppConfig(config);

  return { ...getBillzStatus(), saved: true };
}

async function checkSavedBillzConnection() {
  const { secretToken } = getBillzAuthConfig();
  if (!secretToken) return { ok: false, status: 'disconnected', error: 'missing-secret' };

  saveBillzState({ billzStatus: 'checking', billzError: '' });
  const result = await checkBillzConnection(secretToken);
  if (result.ok) return saveBillzState({ billzStatus: 'connected', billzError: '' });

  return {
    ...saveBillzState({ billzStatus: 'error', billzError: result.error || 'auth-error' }),
    ok: false,
    error: result.error || 'auth-error',
    statusCode: result.statusCode || 0,
  };
}

function buildDiagnosticsLog(diagnostics) {
  return {
    checkedAt: diagnostics.checkedAt,
    apiBaseUrl: diagnostics.apiBaseUrl || '',
    endpoints: (diagnostics.endpoints || []).map((item) => ({
      method: item.method,
      params: item.params || {},
      status: item.status,
      result: item.result,
      errorMessage: item.errorMessage || '',
      errorData: item.errorData ?? null,
      code: item.code,
      count: item.count,
      sampleKeys: item.sampleKeys || [],
      sampleFields: item.sampleFields || {},
      sample: item.sample || null,
    })),
  };
}

async function runSavedBillzDiagnostics() {
  const { secretToken } = getBillzAuthConfig();
  if (!secretToken) return { ok: false, status: 'disconnected', error: 'missing-secret', endpoints: [] };

  saveBillzState({ billzStatus: 'checking', billzError: '' });
  const diagnostics = await runBillzDiagnostics(secretToken, { methods: DIAGNOSTIC_METHODS });
  if (!diagnostics.ok) {
    return {
      ...saveBillzState({ billzStatus: 'error', billzError: diagnostics.error || 'auth-error' }),
      ok: false,
      error: diagnostics.error || 'auth-error',
      endpoints: diagnostics.endpoints || [],
    };
  }

  lastBillzDiagnostics = diagnostics;
  safeWriteJson(BILLZ_DIAGNOSTICS_FILE, buildDiagnosticsLog(diagnostics));
  return {
    ...saveBillzState({ billzStatus: 'connected', billzError: '' }),
    diagnostics,
  };
}

async function searchSavedBillzProducts(payload = {}) {
  const { secretToken } = getBillzAuthConfig();
  if (!secretToken) return { ok: false, status: 'disconnected', error: 'missing-secret', products: [] };

  const query = String(payload.query || payload.search || '').trim();
  const limit = Math.max(1, Math.min(20, Number(payload.limit || 5)));
  const result = await searchBillzCatalog(secretToken, query, 1, limit);
  if (!result.ok) {
    return {
      ok: false,
      status: 'error',
      error: result.code || 'unknown',
      errorMessage: result.errorMessage || result.result || '',
      errorData: result.errorData ?? null,
      products: [],
    };
  }

  return {
    ok: true,
    status: 'connected',
    query,
    count: result.count,
    products: compactProductContext(result.products, limit),
  };
}

function normalizeOpenRouterError(error, status = 0) {
  const message = String(error?.message || error || '').toLowerCase();
  if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('invalid')) {
    return 'invalid-key';
  }
  if (status === 429 || message.includes('rate limit') || message.includes('quota')) {
    return 'rate-limit';
  }
  if (message.includes('fetch failed') || message.includes('network') || message.includes('enotfound') || message.includes('econn')) {
    return 'network';
  }
  return 'unknown';
}

async function testOpenRouterApiKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || !key.startsWith('sk-or-')) {
    return { ok: false, error: 'invalid-key' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://github.com/antegak/lightfoot-sender',
        'X-Title': 'LightFoot Sender',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 8,
        messages: [
          { role: 'system', content: 'Reply with OK.' },
          { role: 'user', content: 'ping' },
        ],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: normalizeOpenRouterError(data?.error?.message, response.status),
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: normalizeOpenRouterError(error) };
  }
}

async function saveOpenRouterApiKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || !key.startsWith('sk-or-')) {
    return { ok: false, error: 'invalid-key' };
  }
  const test = await testOpenRouterApiKey(key);
  if (!test.ok) return test;
  const config = readAppConfig();
  config.openrouterApiKey = key;
  writeAppConfig(config);
  return { ok: true, connected: true };
}

function readAiMemory() {
  const memory = safeReadJson(AI_MEMORY_FILE, { liked: [], disliked: [] });
  return {
    liked: Array.isArray(memory.liked) ? memory.liked.slice(-10) : [],
    disliked: Array.isArray(memory.disliked) ? memory.disliked.slice(-10) : [],
  };
}

function writeAiMemory(memory) {
  const normalized = {
    liked: Array.isArray(memory?.liked) ? memory.liked.slice(-20) : [],
    disliked: Array.isArray(memory?.disliked) ? memory.disliked.slice(-20) : [],
  };
  safeWriteJson(AI_MEMORY_FILE, normalized);
  return normalized;
}

function buildAiMemoryHints(memory) {
  const liked = (memory?.liked || []).slice(-10).map((item) => item.reason).filter(Boolean);
  const disliked = (memory?.disliked || []).slice(-10).map((item) => item.reason).filter(Boolean);
  const hints = [];
  if (liked.length) hints.push(`Память: пользователю раньше понравилось: ${liked.join('; ')}.`);
  if (disliked.length) hints.push(`Память: избегай того, что пользователю не понравилось: ${disliked.join('; ')}.`);
  return hints.join('\n');
}

function rememberAiFeedback(payload = {}) {
  const tone = payload.tone === 'disliked' ? 'disliked' : 'liked';
  const reason = String(payload.reason || '').trim().slice(0, 240);
  const memory = readAiMemory();
  memory[tone].push({
    reason: reason || (tone === 'liked' ? 'Понравился вариант без уточнения' : 'Не подошёл вариант без уточнения'),
    mode: payload.mode === 'improve' ? 'improve' : 'create',
    createdAt: new Date().toISOString(),
  });
  return writeAiMemory(memory);
}

function readCollectProgress() {
  const raw = safeReadJson(COLLECT_PROGRESS_FILE, { bases: {} });
  if (raw && typeof raw === 'object' && raw.bases && typeof raw.bases === 'object') {
    return { bases: raw.bases };
  }
  return { bases: {} };
}

function writeCollectProgress(progress) {
  safeWriteJson(COLLECT_PROGRESS_FILE, {
    bases: progress && typeof progress.bases === 'object' ? progress.bases : {},
  });
}

function getBaseCollectProgress(baseId) {
  const progress = readCollectProgress();
  const item = progress.bases?.[baseId] || {};
  return {
    lastSeenPhone: String(item.lastSeenPhone || item.lastParsedPhone || ''),
    lastSeenName: String(item.lastSeenName || item.lastParsedName || ''),
    lastCollectedAt: String(item.lastCollectedAt || ''),
    accountId: String(item.accountId || item.collectedFromAccountId || ''),
  };
}

function setBaseCollectProgress(baseId, patch = {}) {
  const progress = readCollectProgress();
  progress.bases = progress.bases || {};
  const current = getBaseCollectProgress(baseId);
  progress.bases[baseId] = {
    lastSeenPhone: String(patch.lastSeenPhone ?? current.lastSeenPhone ?? ''),
    lastSeenName: String(patch.lastSeenName ?? current.lastSeenName ?? ''),
    lastCollectedAt: String(patch.lastCollectedAt ?? current.lastCollectedAt ?? ''),
    accountId: String(patch.accountId ?? current.accountId ?? ''),
    updatedAt: new Date().toISOString(),
  };
  writeCollectProgress(progress);
  return progress.bases[baseId];
}

async function requestOpenRouterChat({
  prompt,
  mode = 'create',
  text,
  billzContext,
  model = 'openai/gpt-4o-mini',
  temperature = 0.7,
  maxTokens = 900,
} = {}) {
  const apiKey = getOpenRouterApiKey();
  const cleanText = String(text || prompt || '').trim().slice(0, 1200);
  const normalizedMode = mode === 'improve' ? 'improve' : (mode === 'billz-test' ? 'billz-test' : 'create');

  if (!hasOpenRouterApiKey()) {
    return { ok: false, error: 'OPENROUTER_API_KEY is not configured' };
  }

  if (!cleanText) {
    return { ok: false, error: 'Text is empty' };
  }

  if (normalizedMode === 'billz-test') {
    const connected = Boolean(billzContext?.connected);
    const products = Array.isArray(billzContext?.products) ? billzContext.products.slice(0, 5) : [];
    const customerContext = humanizeBillzProducts(products, { limit: 5 });
    const promptBillzContext = {
      connected,
      query: billzContext?.query || cleanText,
      products,
      parsedQuery: billzContext?.parsedQuery || null,
      detectedIntent: billzContext?.detectedIntent || '',
      sizeRecommendation: billzContext?.sizeRecommendation || null,
      searchDebug: billzContext?.searchDebug || null,
      searchSummary: billzContext?.searchSummary || null,
      brandSummary: billzContext?.brandSummary || null,
      conversationMemory: billzContext?.conversationMemory || null,
      memorySummary: billzContext?.memorySummary || '',
      memoryEntities: billzContext?.memoryEntities || {},
      recentMessages: Array.isArray(billzContext?.recentMessages) ? billzContext.recentMessages.slice(-10) : [],
      recommendations: Array.isArray(billzContext?.recommendations) ? billzContext.recommendations.slice(0, 5) : [],
      recommendationReasoning: billzContext?.recommendationReasoning || [],
      totalCachedProducts: Number(billzContext?.totalCachedProducts || 0),
      matchedProducts: Number(billzContext?.matchedProducts ?? products.length),
      searchMode: billzContext?.searchMode || '',
      humanized: humanizeBillzProducts(products, { limit: 5, includeDebug: true }),
      deterministicDraft: billzContext?.humanizedResponse?.text || '',
      responseStrategy: billzContext?.humanizedResponse?.strategy || '',
      templateUsed: billzContext?.humanizedResponse?.templateUsed || '',
      fallbackReason: billzContext?.humanizedResponse?.fallbackReason || '',
      updatedAt: billzContext?.updatedAt || new Date().toISOString(),
    };
    logger.info(LOG_CATEGORIES.AI, 'BILLZ test context prepared', { promptBillzContext });
    const systemPrompt = [
      'Ты тестовый ИИ LightFoot Sender.',
      'Ты — дружелюбный менеджер магазина босоногой обуви LightFoot.',
      'Это окно только для проверки OpenRouter и BILLZ. Не отправляй сообщения клиентам и не делай автоответы.',
      'Отвечай как живой WhatsApp-менеджер: дружелюбно, легко, коротко и понятно.',
      'Используй немного эмодзи: 💛 желательно в большинстве ответов, также можно 🙌, 👌, 😊. Не используй 🤖 и 🚀.',
      'Никогда не показывай клиенту SKU, артикулы, barcode, stock count, технические поля API, JSON и office codes.',
      'Не говори слово "остаток" и не используй технический стиль.',
      'Используй только название модели, цену, размер и реальные адреса магазинов.',
      'Если можешь определить цвет модели, используй человеческое название цвета: бежевые, черные, зеленые, бордовые.',
      'Не перечисляй слишком много товаров.',
      'Если найдено несколько товаров без конкретной модели, кратко подтверди наличие, назови диапазон цен и предложи подобрать фото/модели.',
      'Если пользователь спрашивает конкретную модель, можно назвать модель, цену, размер и адреса.',
      'Если intent=sizing и есть sizeRecommendation, помоги подобрать размер по длине стопы.',
      'Если intent=brand_list, отвечай по brandSummary и не говори, что товаров нет.',
      'Если клиент спрашивает бренд, которого нет в products, не заменяй его на TipsieToes. Скажи честно, что этого бренда сейчас не вижу, и мягко предложи альтернативы.',
      'Если клиент спрашивает обувь для ребенка, не предлагай взрослую линейку TipsieToes как детскую. Ориентируйся на Little Light, Saguaro или уточни возраст/длину стопы.',
      'Deterministic draft is the final customer-facing meaning. Do not add questions, brands, sizes, product facts, medical claims, or sales pushes that are not already in the deterministic draft or responsePlan.',
      'If responsePlan.shouldClarify=false, do not add a clarification question.',
      'Do not change active subject, gallery intent, search permission, recommended brands, or product facts.',
      connected
        ? 'BILLZ подключен. Используй только клиентский BILLZ context. Если available=false или products пустой, скажи, что сейчас не вижу подходящих вариантов.'
        : 'BILLZ не подключен. Обязательно ответь: "BILLZ не подключен, данные о товарах пока недоступны."',
    ].join('\n');
    const userPrompt = [
      `Вопрос пользователя: ${cleanText}`,
      '',
      `Клиентский BILLZ context: ${connected ? JSON.stringify(customerContext, null, 2) : 'нет данных'}`,
      `Brand summary: ${JSON.stringify(billzContext?.brandSummary || null, null, 2)}`,
      `Search summary: ${JSON.stringify(billzContext?.searchSummary || null, null, 2)}`,
      `Conversation memory: ${JSON.stringify(billzContext?.conversationMemory || billzContext?.memoryEntities || null, null, 2)}`,
      `Memory summary: ${billzContext?.memorySummary || ''}`,
      `Recent messages: ${JSON.stringify((billzContext?.recentMessages || []).slice(-10), null, 2)}`,
      `Recommendations: ${JSON.stringify((billzContext?.recommendations || []).slice(0, 5), null, 2)}`,
      `Recommendation reasoning: ${JSON.stringify(billzContext?.recommendationReasoning || [], null, 2)}`,
      `Deterministic draft: ${billzContext?.humanizedResponse?.text || ''}`,
      `Response strategy: ${billzContext?.humanizedResponse?.strategy || ''}`,
      `Template used: ${billzContext?.humanizedResponse?.templateUsed || ''}`,
      `Fallback reason: ${billzContext?.humanizedResponse?.fallbackReason || ''}`,
      `Detected intent: ${billzContext?.detectedIntent || 'unknown'}`,
      `Parsed query: ${JSON.stringify(billzContext?.parsedQuery || null, null, 2)}`,
      `Size recommendation: ${JSON.stringify(billzContext?.sizeRecommendation || null, null, 2)}`,
      '',
      'Инструкция:',
      'Отвечай клиенту только по клиентскому BILLZ context.',
      'Не показывай технические поля и не называй SKU/артикул/barcode/stock/office.',
      'Цвета бери из displayColor/color. Не показывай цветовые коды вроде BK, BE, LG, WR.',
    ].join('\n');

    const fallbackReasoning = buildReasoningObject(billzContext || {}, billzContext?.humanizedResponse || {});
    const reasoningSystemPrompt = buildLightfootConsultantReasoningPrompt({ connected });
    const reasoningUserPrompt = buildReasoningUserPrompt({
      ...(billzContext || {}),
      query: billzContext?.query || cleanText,
      reasoningFallback: fallbackReasoning,
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/antegak/lightfoot-sender',
        'X-Title': 'LightFoot Sender',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: Math.min(maxTokens, 350),
        messages: [
          {
            role: 'system',
            content: reasoningSystemPrompt,
          },
          {
            role: 'user',
            content: reasoningUserPrompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: normalizeOpenRouterError(data?.error?.message, response.status) };
    }

    const rawText = data?.choices?.[0]?.message?.content || '';
    const reasoningObject = parseReasoningObject(rawText, fallbackReasoning);
    return {
      ok: true,
      text: rawText,
      rawText,
      reasoningObject,
      mode: normalizedMode,
      billzConnected: connected,
      billzItems: products.length,
      billzContext: promptBillzContext,
      model: data?.model || model,
    };
  }

  const aiMemory = readAiMemory();
  const memoryHints = buildAiMemoryHints(aiMemory);

  const systemPrompt = [
    'ROLE: LightFoot — рассылки.',
    '',
    'Ты — маркетолог бренда босоногой обуви LightFoot.',
    'Пишешь короткие рассылки, которые читаются спокойно и не раздражают.',
    '',
    'Ты понимаешь, как донести смысл и подтолкнуть к действию,',
    'но не используешь дешёвые рекламные приёмы.',
    '',
    'ГЛАВНАЯ ЗАДАЧА',
    '— быстро донести суть',
    '— зацепить без давления',
    '— привести к действию',
    '',
    'НАЧАЛО СООБЩЕНИЯ',
    'Сообщение всегда начинается с:',
    '— «Здравствуйте,»',
    'или',
    '— «Добрый день,»',
    '',
    'Нельзя использовать:',
    '— «Привет»',
    '— любые неформальные приветствия',
    '',
    'СТИЛЬ',
    '— простой язык',
    '— уверенный тон',
    '— без лишних эмоций',
    '— без «сюсюканья»',
    '',
    'ДЛИНА',
    '— 2–4 коротких абзаца',
    '— без длинных текстов',
    '',
    'СТРУКТУРА',
    'приветствие',
    'короткая зацепка / факт',
    'суть (скидка / новость / наличие)',
    'мягкое действие',
    '',
    'КАК ПИСАТЬ',
    '— короткие предложения',
    '— понятная логика',
    '— без лишних слов',
    '',
    'ЧТО НЕЛЬЗЯ',
    '— «это не…, это про…»',
    '— «секрет в том»',
    '— «фишка в том»',
    '— «на самом деле»',
    '— «по сути»',
    '— «уникальный»',
    '— «революционный»',
    '— «новый уровень»',
    '— «лучшее предложение»',
    '— «не упустите шанс»',
    '— «срочно»',
    '— «покупайте сейчас»',
    '— «успейте»',
    '— «только сегодня»',
    '— «важно понимать»',
    '— «ключ к успеху»',
    '— «ценные инсайты»',
    '',
    'CTA',
    '— спокойное',
    '— без давления',
    'Примеры:',
    '— «можно зайти и примерить»',
    '— «напишите, подскажем»',
    '',
    'ВАЖНО',
    '— не использовать много восклицательных знаков',
    '— не писать КАПСОМ',
    '— не перегружать текст',
    '— если выглядит как реклама — плохо',
    '',
    'ПРИЗНАК ХОРОШЕГО ТЕКСТА',
    '— читается быстро',
    '— понятен с первого раза',
    '— не раздражает',
    '',
    memoryHints,
    '',
    'Верни только готовые варианты текста, без пояснений.',
  ].filter(Boolean).join('\n');

  const userPrompt = normalizedMode === 'improve'
    ? [
        'Тебе дали текст для WhatsApp.',
        'Сделай его проще, живее и естественнее. Сохрани смысл.',
        'Вывод: улучшенная версия и ещё 1–2 варианта.',
        'Оформи как:',
        'Вариант 1: ...',
        'Вариант 2: ...',
        'Вариант 3: ...',
        '',
        `Текст: ${cleanText}`,
      ].join('\n')
    : [
        'Создай 3 коротких варианта сообщения для WhatsApp.',
        'Оформи как:',
        'Вариант 1: ...',
        'Вариант 2: ...',
        'Вариант 3: ...',
        '',
        `Тема: ${cleanText}`,
      ].join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/antegak/lightfoot-sender',
      'X-Title': 'LightFoot Sender',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: normalizeOpenRouterError(data?.error?.message, response.status),
    };
  }

  return {
    ok: true,
    text: ensureCustomerAddresses(data?.choices?.[0]?.message?.content || ''),
    mode: normalizedMode,
    model: data?.model || model,
  };
}

async function requestAiTestChat(payload = {}) {
  const text = String(payload.text || '').trim();
  if (!text) return { ok: false, error: 'Text is empty' };
  if (payload.reset) {
    aiSandboxHistory = [];
    lastAiDebugState = null;
    aiConversationMemory.reset();
    aiSandboxMemory = { currentBrand: null, currentColor: null, currentSize: null, currentMaterial: null, currentIntent: null, customerType: null, footLength: null, childAgeGroup: null };
  }

  syncAiSandboxMemoryFromConversation();
  const billzStatus = getBillzStatus();
  const { secretToken } = getBillzAuthConfig();
  const previousMemoryState = aiConversationMemory.getState();
  const preParsedQuery = parseCustomerQuery(text);
  const preConversationState = buildConversationState({
    query: text,
    parsedQuery: preParsedQuery,
    memoryState: previousMemoryState,
    previousState: lastAiDebugState?.conversationState || {},
    searchResults: {},
  });
  const preResponsePlan = buildResponsePlan({
    query: text,
    parsedQuery: preParsedQuery,
    conversationState: preConversationState,
    searchResults: {},
    billzConnected: Boolean(billzStatus.connected && secretToken),
  });
  const shouldSearchProducts = Boolean(preResponsePlan.shouldSearchProducts);
  const billzAiContext = billzStatus.connected && secretToken && shouldSearchProducts
    ? await getBillzContextForAi(secretToken, text, { memory: previousMemoryState.entities || {} })
    : {
        connected: Boolean(billzStatus.connected && secretToken),
        ok: Boolean(billzStatus.connected && secretToken),
        query: text,
        error: billzStatus.connected && secretToken ? '' : (billzStatus.error || 'billz-not-connected'),
        products: [],
        recommendations: [],
        recommendationReasoning: [],
        parsedQuery: preParsedQuery,
        detectedIntent: preParsedQuery.intent || 'unknown',
        sizeRecommendation: preParsedQuery.sizeRecommendation || null,
        searchDebug: shouldSearchProducts ? null : { skipped: true, reason: 'conversation_state_no_product_search' },
        searchSummary: shouldSearchProducts ? null : { mode: 'conversation', skipped: true, confidence: preConversationState.confidence, lowConfidence: preConversationState.confidence < 60 },
        brandSummary: null,
        totalCachedProducts: 0,
        matchedProducts: 0,
        searchMode: shouldSearchProducts ? '' : 'conversation-no-search',
        updatedAt: new Date().toISOString(),
      };
  logger.info(LOG_CATEGORIES.AI, 'AI parser boundary', {
    intent: billzAiContext.detectedIntent,
    parsedQuery: billzAiContext.parsedQuery,
  });
  updateAiSandboxMemory(billzAiContext.parsedQuery || {});
  aiConversationMemory.addUserMessage(text, billzAiContext.parsedQuery || {});
  const memoryState = aiConversationMemory.getState();
  const conversationContext = buildConversationContext(memoryState, billzAiContext.parsedQuery || {}, billzAiContext.products || []);
  const customerProfile = buildCustomerProfile(memoryState, billzAiContext.parsedQuery || {});
  const conversationState = buildConversationState({
    query: text,
    parsedQuery: billzAiContext.parsedQuery || {},
    memoryState,
    previousState: preConversationState,
    searchResults: billzAiContext,
  });
  const responsePlan = buildResponsePlan({
    query: text,
    parsedQuery: billzAiContext.parsedQuery || {},
    conversationState,
    searchResults: billzAiContext,
    billzConnected: Boolean(billzStatus.connected && secretToken),
  });
  const products = billzAiContext.connected ? billzAiContext.products : [];
  const productGallery = buildProductGallery(products, {
    intent: responsePlan.mode === 'product_gallery' ? 'product_gallery' : '',
    limit: 5,
  });
  conversationState.currentIntent = responsePlan.intent;
  if (['nail_problem', 'pain_problem', 'comfort_problem', 'toe_pain', 'wide_foot', 'walking_fatigue', 'posture_problem', 'health_concern'].includes(responsePlan.intent)) {
    conversationState.lastHealthIntent = responsePlan.intent;
    conversationState.lastHealthIntentTurns = 4;
  }
  conversationState.shouldSearchProducts = responsePlan.shouldSearchProducts;
  if (responsePlan.shouldClarify) {
    conversationState.nextBestAction = 'ask_clarifying_question';
    conversationState.clarificationCount = Number(conversationState.clarificationCount || 0) + 1;
    conversationState.lastClarificationReason = 'critical_info_missing';
  } else if (responsePlan.mode === 'availability_check' && responsePlan.shouldSearchProducts) {
    conversationState.nextBestAction = 'recommend_product';
  } else if (responsePlan.shouldRecommend && !responsePlan.shouldSearchProducts && conversationState.nextBestAction !== 'progress_conversation') {
    conversationState.nextBestAction = 'recommend_direction';
  }
  applyRecommendationProgression(conversationState, responsePlan);
  conversationState.selectedDialogueMove = conversationState.nextBestAction;
  conversationState.reasonForNextBestAction = responsePlan.orchestrationReason || conversationState.reasonForNextBestAction;
  logger.info(LOG_CATEGORIES.AI, 'AI memory merge', {
    previousEntities: previousMemoryState.entities || {},
    currentEntities: memoryState.entities || {},
    previousIntent: conversationContext.previousIntent,
  });
  logger.info(LOG_CATEGORIES.AI, 'AI conversation state', {
    currentFocus: conversationState.currentFocus,
    currentStage: conversationState.currentStage,
    activeSubject: conversationState.activeSubject,
    nextBestAction: conversationState.nextBestAction,
    freedomLevel: conversationState.freedomLevel,
    hasNewInfo: conversationState.hasNewInfo,
    newInfoType: conversationState.newInfoType,
    selectedDialogueMove: conversationState.selectedDialogueMove,
    reasonForNextBestAction: conversationState.reasonForNextBestAction,
    blockedByRepetition: conversationState.blockedByRepetition,
    shouldSearchProducts: conversationState.shouldSearchProducts,
    responseMode: responsePlan.mode,
    responseIntent: responsePlan.intent,
    recommendationConfidence: responsePlan.recommendationConfidence,
    anchoredSubject: conversationState.anchoredConversationSubject,
    galleryIntent: responsePlan.galleryIntent,
    mediaFound: productGallery.mediaFound,
    selectedProducts: productGallery.selectedProducts,
  });
  const billzContext = buildAiContext({
    query: text,
    billzContext: {
    connected: Boolean(billzStatus.connected && billzAiContext.connected),
    query: billzAiContext.query || text,
    products,
    recommendations: billzAiContext.recommendations || [],
    recommendationReasoning: billzAiContext.recommendationReasoning || [],
    parsedQuery: billzAiContext.parsedQuery || null,
    detectedIntent: billzAiContext.detectedIntent || 'unknown',
    sizeRecommendation: billzAiContext.sizeRecommendation || null,
    searchDebug: billzAiContext.searchDebug || null,
    searchSummary: billzAiContext.searchSummary || null,
    brandSummary: billzAiContext.brandSummary || null,
    totalCachedProducts: Number(billzAiContext.totalCachedProducts || 0),
    matchedProducts: Number(billzAiContext.matchedProducts ?? products.length),
    searchMode: billzAiContext.searchMode || '',
    updatedAt: billzAiContext.updatedAt || new Date().toISOString(),
    status: billzStatus.status,
	    error: billzAiContext.connected ? '' : (billzAiContext.error || 'billz-error'),
	    },
	    memoryState,
	    maxProducts: 5,
  });
  billzContext.conversationContext = conversationContext;
  billzContext.conversationState = conversationState;
  billzContext.responsePlan = responsePlan;
  billzContext.productGallery = productGallery;
  billzContext.customerProfile = {
    ...customerProfile.inferredCustomerProfile,
    stage7: conversationState.customerProfile,
    adultProfile: conversationState.adultProfile,
    childProfile: conversationState.childProfile,
    teenProfile: conversationState.teenProfile,
    activeSubject: conversationState.activeSubject,
  };
  let humanizedResponse = formatHumanResponse(billzContext);
  const reasoningObject = buildReasoningObject(billzContext, humanizedResponse);
  billzContext.reasoningObject = reasoningObject;
  billzContext.aiConfidence = reasoningObject.confidence;
  humanizedResponse = formatHumanResponse(billzContext);
  let dialoguePolicy = applyDialoguePolicy(humanizedResponse.text, conversationState, {
    previousAssistantText: lastAiDebugState?.formatterOutputPreview || '',
  });
  if (dialoguePolicy.repetition.blockedByRepetition) {
    conversationState.blockedByRepetition = true;
    conversationState.nextBestAction = 'progress_conversation';
    conversationState.selectedDialogueMove = 'progress_conversation';
    conversationState.reasonForNextBestAction = 'blocked_by_repetition';
    billzContext.conversationState = conversationState;
    humanizedResponse = formatHumanResponse(billzContext);
    dialoguePolicy = applyDialoguePolicy(humanizedResponse.text, conversationState);
  }
  humanizedResponse.text = dialoguePolicy.text;
  humanizedResponse.dialoguePolicy = dialoguePolicy;
  billzContext.humanizedResponse = humanizedResponse;
  logger.info(LOG_CATEGORIES.AI, 'AI formatter output', {
    strategy: humanizedResponse.strategy,
    templateUsed: humanizedResponse.templateUsed,
    confidence: reasoningObject.confidence,
    clarificationNeeded: reasoningObject.clarificationNeeded,
  });

  const result = await requestOpenRouterChat({
    mode: 'billz-test',
    text,
    billzContext: { ...billzContext, conversationMemory: aiSandboxMemory },
  });
  if (!result?.ok) {
    result.ok = true;
    result.aiError = result.error || 'reasoning-layer-unavailable';
    result.text = humanizedResponse.text || '';
    result.reasoningObject = reasoningObject;
    result.rawText = '';
  }
  if (result?.ok) {
    result.rawText = result.rawText || result.text || '';
    result.reasoningObject = { ...reasoningObject, ...(result.reasoningObject || {}) };
    result.text = humanizedResponse.text || result.text || '';
    aiConversationMemory.addAssistantMessage(result.text || '');
    aiSandboxHistory.push({ role: 'user', content: text, createdAt: new Date().toISOString() });
    aiSandboxHistory.push({ role: 'assistant', content: result.text || '', createdAt: new Date().toISOString() });
    aiSandboxHistory = aiSandboxHistory.slice(-15);
    result.conversationMemory = aiSandboxMemory;
    result.memory = aiConversationMemory.getState();
    result.searchDebug = billzContext.searchDebug || null;
    result.humanizedResponse = humanizedResponse;
    result.reasoningObject = result.reasoningObject || reasoningObject;
    result.aiConfidence = result.reasoningObject.confidence;
    result.customerProfile = billzContext.customerProfile;
    result.conversationContext = conversationContext;
    result.conversationState = conversationState;
    result.responsePlan = responsePlan;
    result.productGallery = productGallery;
    result.recommendationReasoning = billzContext.recommendationReasoning || [];
    result.history = aiSandboxHistory;
  }
  lastAiDebugState = {
    parsedQuery: billzContext.parsedQuery || null,
    searchSummary: billzContext.searchSummary || null,
    searchDebug: billzContext.searchDebug || null,
    memory: aiConversationMemory.getState(),
    matchedProducts: products.slice(0, 5),
    normalizedProductPreview: billzContext.normalizedProducts || [],
    reasoningObject: result.reasoningObject || reasoningObject,
    formatterOutputPreview: humanizedResponse.text || '',
    customerProfile: billzContext.customerProfile || null,
    responsePlan,
    selectedMode: responsePlan.selectedMode,
    selectedIntent: responsePlan.selectedIntent,
    recommendationConfidence: responsePlan.recommendationConfidence,
    clarificationAllowed: responsePlan.clarificationAllowed,
    searchAllowed: responsePlan.searchAllowed,
    activeProfile: responsePlan.activeProfile,
    orchestrationReason: responsePlan.orchestrationReason,
    anchoredSubject: conversationState.anchoredConversationSubject,
    subjectConfidence: conversationState.anchoredConversationSubject?.confidence || 0,
    responseMode: responsePlan.mode,
    galleryIntent: responsePlan.galleryIntent,
    mediaFound: productGallery.mediaFound,
    selectedProducts: productGallery.selectedProducts,
    recommendationReason: responsePlan.orchestrationReason,
    conversationState: {
      currentFocus: conversationState.currentFocus,
      currentStage: conversationState.currentStage,
      activeSubject: conversationState.activeSubject,
      anchoredConversationSubject: conversationState.anchoredConversationSubject,
      nextBestAction: conversationState.nextBestAction,
      shouldSearchProducts: conversationState.shouldSearchProducts,
      currentIntent: conversationState.currentIntent,
      previousIntent: conversationState.previousIntent,
      lastHealthIntent: conversationState.lastHealthIntent,
      lastHealthIntentTurns: conversationState.lastHealthIntentTurns,
      freedomLevel: conversationState.freedomLevel,
      hasNewInfo: conversationState.hasNewInfo,
      newInfoType: conversationState.newInfoType,
      newInfo: conversationState.newInfo,
      blockedByRepetition: conversationState.blockedByRepetition,
      selectedDialogueMove: conversationState.selectedDialogueMove,
      reasonForNextBestAction: conversationState.reasonForNextBestAction,
      customerProfile: conversationState.customerProfile,
      adultProfile: conversationState.adultProfile,
      childProfile: conversationState.childProfile,
      teenProfile: conversationState.teenProfile,
      salesFlow: conversationState.salesFlow,
      missingInfo: conversationState.missingInfo,
      clarificationCount: conversationState.clarificationCount,
      lastClarificationReason: conversationState.lastClarificationReason,
      lastRecommendation: conversationState.lastRecommendation,
      recommendationHistory: conversationState.recommendationHistory,
      confidence: conversationState.confidence,
    },
    clarificationState: conversationContext.clarificationState,
    aiConfidence: result.aiConfidence || reasoningObject.confidence,
    fallbackLogic: {
      mode: billzContext.searchMode || '',
      fallbackUsed: Boolean(billzContext.searchSummary?.fallbackUsed),
    },
    responseStrategy: humanizedResponse.strategy,
    templateUsed: humanizedResponse.templateUsed,
    memorySummary: billzContext.memorySummary || '',
    fallbackReason: humanizedResponse.fallbackReason || '',
    humanizedDebug: humanizedResponse.debug || null,
    recommendationReasoning: billzContext.recommendationReasoning || [],
    updatedAt: new Date().toISOString(),
  };
  return result;
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (/^0\d{9,}$/.test(digits)) return `996${digits.slice(1, 10)}`;
  if (/^996\d{9,}$/.test(digits)) return digits.slice(0, 12);
  return digits;
}

function normalizePhoneKey(phone) {
  return normalizePhone(phone);
}

function normalizeName(name) {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU');
}

function normalizeContact(contact = {}, fallbackSource = 'manual') {
  const now = new Date().toISOString();
  const rawName = String(contact?.name || contact?.title || '').replace(/\s+/g, ' ').trim();
  const rawPhone = String(contact?.phone || contact?.number || contact?.tel || '').trim();
  const normalizedPhone =
    normalizePhone(rawPhone) ||
    normalizePhone(contact?.normalizedPhone) ||
    normalizePhone(contact?.number) ||
    normalizePhone(contact?.tel) ||
    '';
  const displayPhone = normalizedPhone ? `+${normalizedPhone}` : rawPhone;
  const sourceMap = {
    chat: 'whatsapp',
    whatsapp: 'whatsapp',
    import: 'import',
    manual: 'manual',
  };
  const source = sourceMap[String(contact?.source || fallbackSource || 'manual').toLowerCase()] || fallbackSource || 'manual';
  const name = rawName || displayPhone || 'Без имени';
  const normalizedName = normalizeName(name);
  const fallbackId = `${source}:${normalizedName || normalizeName(name) || 'contact'}`;
  const id = normalizedPhone || String(contact?.id || fallbackId).trim() || fallbackId;

  return {
    ...contact,
    id,
    name,
    phone: displayPhone,
    normalizedPhone,
    normalizedName,
    source,
    createdAt: contact?.createdAt || now,
    updatedAt: now,
  };
}

function isBetterContactName(candidate, current) {
  const next = String(candidate || '').trim();
  const prev = String(current || '').trim();
  if (!next) return false;
  if (!prev) return true;
  if (/^\+?\d+$/.test(prev) && !/^\+?\d+$/.test(next)) return true;
  if (prev === 'Без имени' && next !== 'Без имени') return true;
  return next.length > prev.length;
}

function mergeDuplicateContact(current, duplicate) {
  const merged = { ...duplicate, ...current };
  if (isBetterContactName(duplicate.name, current.name)) merged.name = duplicate.name;
  if (!current.phone && duplicate.phone) merged.phone = duplicate.phone;
  if (!current.normalizedPhone && duplicate.normalizedPhone) merged.normalizedPhone = duplicate.normalizedPhone;
  if (!current.normalizedName && duplicate.normalizedName) merged.normalizedName = duplicate.normalizedName;
  if (!current.source && duplicate.source) merged.source = duplicate.source;
  merged.updatedAt = duplicate.updatedAt || current.updatedAt || new Date().toISOString();
  return merged;
}

function dedupeContacts(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const seenByPhone = new Map();
  const normalized = [];
  const duplicates = [];
  let removedByPhone = 0;

  for (const rawContact of list) {
    if (!rawContact) continue;
    const contact = normalizeContact(rawContact, rawContact?.source || 'manual');
    const phoneKey = normalizePhone(contact.normalizedPhone) || normalizePhone(contact.phone);

    if (phoneKey) {
      contact.normalizedPhone = phoneKey;
      contact.phone = `+${phoneKey}`;
      contact.id = phoneKey;
    }

    if (phoneKey && seenByPhone.has(phoneKey)) {
      const index = seenByPhone.get(phoneKey);
      duplicates.push({ duplicate: contact, original: normalized[index], key: `phone:${phoneKey}`, bucket: 'phone' });
      removedByPhone += 1;
      normalized[index] = mergeDuplicateContact(normalized[index], contact);
      continue;
    }

    if (phoneKey) seenByPhone.set(phoneKey, normalized.length);
    normalized.push(contact);
  }

  const removed = list.length - normalized.length;
  return {
    contacts: normalized,
    totalBefore: list.length,
    totalAfter: normalized.length,
    removed,
    duplicates: duplicates.length,
    removedByPhone,
    removedByName: 0,
    duplicateItems: duplicates,
    invalid: 0,
    removedInvalid: 0,
  };
}

function dedupeContactsWithStats(contacts) {
  const stats = dedupeContacts(contacts);
  return {
    ...stats,
    total: stats.totalBefore,
    final: stats.totalAfter,
    removedDuplicates: stats.duplicates,
    removedByPhone: stats.removedByPhone,
    removedByName: stats.removedByName,
  };
}

function sanitizeContacts(contacts) {
  return dedupeContacts(contacts).contacts;
}

function validateSectionName(name, existingItems = [], options = {}) {
  const result = NameUtils.validateName(name, existingItems, options);
  if (!result.ok) throw new Error(result.error);
  return result.name;
}

function uniquePathInDirectory(directory, baseName, extension) {
  ensureDir(directory);

  const safeBaseName = NameUtils.toSafeFileBaseName(baseName);
  const safeExtension = String(extension || '').replace(/^\./, '');
  let index = 0;
  let candidateName = `${safeBaseName}.${safeExtension}`;
  let candidatePath = path.join(directory, candidateName);

  while (fs.existsSync(candidatePath)) {
    index += 1;
    candidateName = `${NameUtils.makeCopyName(safeBaseName, index)}.${safeExtension}`;
    candidatePath = path.join(directory, candidateName);
  }

  return candidatePath;
}

async function confirmOverwrite(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return true;

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Перезаписать', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    title: 'Файл уже существует',
    message: 'Файл с таким названием уже существует.',
    detail: path.basename(filePath),
  });

  return result.response === 0;
}

function slugifyBaseName(name = '') {
  const slug = String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return slug || `base_${Date.now().toString(36)}`;
}

function makeBaseId() {
  return `base-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStoredBases() {
  const sourceFile = fs.existsSync(BASES_FILE) ? BASES_FILE : LEGACY_BASES_FILE;
  const raw = safeReadJson(sourceFile, []);
  return Array.isArray(raw) ? raw : [];
}

function saveStoredBases(bases) {
  ensureDir(DATA_DIR);
  const normalized = Array.isArray(bases)
    ? bases.filter(Boolean).map((base) => ({
        id: String(base.id),
        name: String(base.name || 'Без названия').trim() || 'Без названия',
        fileName: String(base.fileName),
        createdAt: Number(base.createdAt || Date.now()),
        updatedAt: Number(base.updatedAt || Date.now()),
      }))
    : [];

  safeWriteJson(BASES_FILE, normalized);
  return normalized;
}

function getBaseById(baseId, bases = getStoredBases()) {
  return bases.find((base) => base.id === baseId) || null;
}

function getBaseFilePath(baseOrId, bases = getStoredBases()) {
  const base = typeof baseOrId === 'string' ? getBaseById(baseOrId, bases) : baseOrId;
  return base ? path.join(DATA_DIR, base.fileName) : null;
}

function readContactsFromFile(filePath) {
  return sanitizeContacts(safeReadJson(filePath, []));
}

function needsContactMigration(rawContacts, stats) {
  if (!Array.isArray(rawContacts)) return true;
  if (stats?.removed > 0) return true;
  return rawContacts.some((contact) => {
    if (!contact || typeof contact !== 'object') return true;
    const normalizedPhone = normalizePhone(contact.phone || contact.number || contact.tel || contact.normalizedPhone);
    const normalizedName = normalizeName(contact.name || contact.title || contact.normalizedName);
    return (
      contact.normalizedPhone !== normalizedPhone ||
      contact.normalizedName !== normalizedName ||
      !contact.id ||
      !contact.name ||
      !contact.source ||
      !contact.createdAt ||
      !contact.updatedAt
    );
  });
}

function backupBaseBeforeMigration(base, rawContacts) {
  ensureDir(BASE_BACKUPS_DIR);
  const safeName = NameUtils.toSafeFileBaseName(base?.name || base?.id || 'base');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BASE_BACKUPS_DIR, `${safeName}-before-migration-${stamp}.json`);
  safeWriteJson(backupPath, Array.isArray(rawContacts) ? rawContacts : []);
  return backupPath;
}

function getBaseContacts(baseId) {
  const filePath = getBaseFilePath(baseId);
  if (!filePath) throw new Error('База не найдена');
  return readContactsFromFile(filePath);
}

function getBaseContactsInfo(baseId, { persist = false } = {}) {
  const bases = getStoredBases();
  const base = getBaseById(baseId, bases);
  const filePath = getBaseFilePath(base, bases);
  if (!filePath) throw new Error('База не найдена');
  const raw = safeReadJson(filePath, []);
  const stats = dedupeContacts(raw);
  const migrated = needsContactMigration(raw, stats);
  let backupPath = '';
  if (persist && migrated) {
    backupPath = backupBaseBeforeMigration(base, raw);
    safeWriteJson(filePath, stats.contacts);
    touchBase(baseId);
  }
  logger.info(LOG_CATEGORIES.CACHE, 'contacts load', {
    baseId,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    removed: stats.removed,
    migrated: persist && migrated,
  });
  return {
    ok: true,
    contacts: stats.contacts,
    total: stats.totalBefore,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    removedDuplicates: stats.duplicates,
    removedByPhone: stats.removedByPhone,
    removedByName: stats.removedByName,
    removedInvalid: stats.removedInvalid,
    removed: stats.removed,
    final: stats.totalAfter,
    migrated: persist && migrated,
    backupPath,
  };
}

function listBases() {
  const bases = getStoredBases();
  return bases.map((base) => ({
    ...base,
    count: readContactsFromFile(getBaseFilePath(base, bases)).length,
  }));
}

function touchBase(baseId) {
  const bases = getStoredBases();
  const nextBases = bases.map((base) =>
    base.id === baseId ? { ...base, updatedAt: Date.now() } : base
  );
  saveStoredBases(nextBases);
}

function writeBaseContacts(baseId, contacts) {
  const bases = getStoredBases();
  const base = getBaseById(baseId, bases);
  if (!base) throw new Error('База не найдена');

  const stats = dedupeContacts(contacts);
  safeWriteJson(getBaseFilePath(base, bases), stats.contacts);
  const nextBases = bases.map((item) =>
    item.id === baseId ? { ...item, updatedAt: Date.now() } : item
  );
  saveStoredBases(nextBases);
  logger.info(LOG_CATEGORIES.CACHE, 'contacts write', {
    baseId,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    removed: stats.removed,
  });
  return {
    total: stats.totalBefore,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    removedDuplicates: stats.duplicates,
    removedByPhone: stats.removedByPhone,
    removedByName: stats.removedByName,
    removedInvalid: stats.removedInvalid,
    removed: stats.removed,
    final: stats.totalAfter,
  };
}

function createContactIdentitySets(contacts) {
  const existingPhones = new Set();
  const existingNames = new Set();

  for (const rawContact of Array.isArray(contacts) ? contacts : []) {
    const contact = normalizeContact(rawContact, rawContact?.source || 'manual');
    const phoneKey = normalizePhone(contact.normalizedPhone) || normalizePhone(contact.phone);
    if (phoneKey) existingPhones.add(phoneKey);
    else if (contact.normalizedName) existingNames.add(contact.normalizedName);
  }

  return { existingPhones, existingNames };
}

function validateBase(baseId) {
  const bases = getStoredBases();
  const base = getBaseById(baseId, bases);
  const filePath = getBaseFilePath(base, bases);
  if (!filePath) throw new Error('База не найдена');

  const raw = safeReadJson(filePath, []);
  const list = Array.isArray(raw) ? raw : [];
  const normalizedContacts = list.map((contact) => normalizeContact(contact, contact?.source || 'manual'));
  const stats = dedupeContacts(list);
  const progress = readCollectProgress();
  const progressForBase = progress.bases?.[baseId] || null;

  const result = {
    ok: true,
    baseId,
    total: normalizedContacts.length,
    withoutNormalizedPhone: normalizedContacts.filter((contact) => !contact.normalizedPhone).length,
    withoutNormalizedName: normalizedContacts.filter((contact) => !contact.normalizedName).length,
    duplicatePhones: stats.removedByPhone,
    duplicateNames: stats.removedByName,
    hasProgress: Boolean(progressForBase),
    progressBaseId: progressForBase ? baseId : '',
    progress: getBaseCollectProgress(baseId),
  };

  logger.info(LOG_CATEGORIES.CACHE, 'base validate', result);
  return result;
}

function dedupeBaseContacts(baseId) {
  const validationBefore = validateBase(baseId);
  const info = getBaseContactsInfo(baseId, { persist: true });
  const validationAfter = validateBase(baseId);
  const result = {
    ...info,
    validationBefore,
    validationAfter,
  };
  logger.info(LOG_CATEGORIES.CACHE, 'contacts dedupe', {
    baseId,
    before: info.totalBefore,
    after: info.totalAfter,
    removedByPhone: info.removedByPhone || 0,
    removedByName: info.removedByName || 0,
  });
  return result;
}

function readNormalizedSendHistory(filePath) {
  const raw = safeReadJson(filePath, {});
  const normalized = {};
  for (const [phone, meta] of Object.entries(raw || {})) {
    const phoneKey = normalizePhoneKey(phone);
    if (!phoneKey) continue;
    normalized[phoneKey] = {
      ...(meta && typeof meta === 'object' ? meta : {}),
      phone: meta?.phone || phone,
      lastSent: Number(meta?.lastSent || 0),
      date: meta?.date || '',
    };
  }
  return normalized;
}

function mergeSendHistories(...histories) {
  const merged = {};
  for (const history of histories) {
    for (const [phoneKey, meta] of Object.entries(history || {})) {
      if (!phoneKey) continue;
      const current = merged[phoneKey];
      if (!current || Number(meta?.lastSent || 0) > Number(current?.lastSent || 0)) {
        merged[phoneKey] = meta;
      }
    }
  }
  return merged;
}

function writeNormalizedSendHistory(filePath, history) {
  safeWriteJson(filePath, history && typeof history === 'object' ? history : {});
}

function makeUniqueBaseFileName(name, bases, excludeId = '') {
  const slug = slugifyBaseName(name);
  let index = 1;
  let candidate = `base_${slug}.json`;

  while (bases.some((base) => base.id !== excludeId && base.fileName === candidate)) {
    index += 1;
    candidate = `base_${slug}_${index}.json`;
  }

  return candidate;
}

function defaultBases() {
  const createdAt = Date.now();
  return [
    {
      id: 'main',
      name: 'Основная база',
      fileName: 'base_main.json',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'new',
      name: 'Новая база',
      fileName: 'base_new.json',
      createdAt: createdAt + 1,
      updatedAt: createdAt + 1,
    },
  ];
}

function migrateLegacyBaseContacts(baseId) {
  if (baseId === 'main') {
    if (fs.existsSync(LEGACY_MAIN_CONTACTS_FILE)) return readContactsFromFile(LEGACY_MAIN_CONTACTS_FILE);
    if (fs.existsSync(LEGACY_CONTACTS_FILE)) return readContactsFromFile(LEGACY_CONTACTS_FILE);
    return [];
  }

  if (baseId === 'new' && fs.existsSync(LEGACY_NEW_CONTACTS_FILE)) {
    return readContactsFromFile(LEGACY_NEW_CONTACTS_FILE);
  }

  return [];
}

function ensureBaseStore() {
  ensureDir(DATA_DIR);

  let bases = getStoredBases();

  if (!bases.length) {
    bases = defaultBases();
    saveStoredBases(bases);
  }

  const seenIds = new Set();
  const seenFiles = new Set();
  const normalized = [];

  for (const base of bases) {
    if (!base || !base.id || !base.fileName) continue;
    if (seenIds.has(base.id) || seenFiles.has(base.fileName)) continue;

    seenIds.add(base.id);
    seenFiles.add(base.fileName);
    normalized.push({
      id: String(base.id),
      name: String(base.name || 'Без названия').trim() || 'Без названия',
      fileName: String(base.fileName),
      createdAt: Number(base.createdAt || Date.now()),
      updatedAt: Number(base.updatedAt || Date.now()),
    });
  }

  if (!normalized.length) {
    normalized.push(...defaultBases());
  }

  for (const base of normalized) {
    const filePath = getBaseFilePath(base, normalized);
    if (fs.existsSync(filePath)) continue;

    const migratedContacts = migrateLegacyBaseContacts(base.id);
    safeWriteJson(filePath, migratedContacts);
  }

  saveStoredBases(normalized);
}

function createBase(name) {
  const bases = getStoredBases();
  const trimmedName = validateSectionName(name, bases, {
    emptyMessage: 'Введите название базы',
    duplicateMessage: 'База с таким названием уже есть',
  });
  const now = Date.now();
  const base = {
    id: makeBaseId(),
    name: trimmedName,
    fileName: makeUniqueBaseFileName(trimmedName, bases),
    createdAt: now,
    updatedAt: now,
  };

  safeWriteJson(getBaseFilePath(base, [...bases, base]), []);
  saveStoredBases([...bases, base]);
  return listBases().find((item) => item.id === base.id);
}

function createBaseWithContacts(name, contacts = []) {
  const base = createBase(name);
  writeBaseContacts(base.id, contacts);
  return listBases().find((item) => item.id === base.id);
}

function renameBase(baseId, name) {
  const bases = getStoredBases();
  const baseIndex = bases.findIndex((base) => base.id === baseId);
  if (baseIndex === -1) throw new Error('База не найдена');
  const trimmedName = validateSectionName(name, bases, {
    currentId: baseId,
    emptyMessage: 'Введите название базы',
    duplicateMessage: 'База с таким названием уже есть',
  });

  const currentBase = bases[baseIndex];
  const nextFileName = makeUniqueBaseFileName(trimmedName, bases, baseId);
  const currentFilePath = getBaseFilePath(currentBase, bases);
  const nextFilePath = path.join(DATA_DIR, nextFileName);

  if (currentFilePath !== nextFilePath) {
    if (fs.existsSync(currentFilePath)) {
      fs.renameSync(currentFilePath, nextFilePath);
    } else {
      safeWriteJson(nextFilePath, []);
    }
  }

  bases[baseIndex] = {
    ...currentBase,
    name: trimmedName,
    fileName: nextFileName,
    updatedAt: Date.now(),
  };

  saveStoredBases(bases);
  return listBases().find((item) => item.id === baseId);
}

function deleteBase(baseId) {
  const bases = getStoredBases();
  if (bases.length <= 1) throw new Error('Нельзя удалить последнюю базу');

  const base = getBaseById(baseId, bases);
  if (!base) throw new Error('База не найдена');

  const nextBases = bases.filter((item) => item.id !== baseId);
  const filePath = getBaseFilePath(base, bases);

  if (filePath) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }

  saveStoredBases(nextBases);
  return listBases();
}

function makeMessageFolderId() {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeMessageVariants(variants) {
  const items = Array.isArray(variants) ? variants : [];
  const normalized = items
    .map((variant) => String(variant || ''))
    .slice(0, 20);

  return normalized.length ? normalized : [''];
}

function normalizeMessageImage(image) {
  const fileName = String(image?.fileName || '').trim();
  if (!fileName) return null;

  const imagePath = path.join(MESSAGE_IMAGES_DIR, path.basename(fileName));
  if (!fs.existsSync(imagePath)) return null;

  return {
    fileName: path.basename(fileName),
    originalName: String(image?.originalName || path.basename(fileName)),
    size: Number(image?.size || 0),
    updatedAt: Number(image?.updatedAt || Date.now()),
  };
}

function withMessageImagePath(folder) {
  const image = normalizeMessageImage(folder?.image);
  return {
    ...folder,
    image: image
      ? {
          ...image,
          path: path.join(MESSAGE_IMAGES_DIR, image.fileName),
        }
      : null,
  };
}

function defaultMessageFolder(variants = ['']) {
  const now = Date.now();
  return {
    id: 'default',
    name: 'Основные сообщения',
    variants: sanitizeMessageVariants(variants),
    image: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMessageStore(rawStore) {
  if (Array.isArray(rawStore)) {
    const folder = defaultMessageFolder(rawStore);
    return { version: 2, activeFolderId: folder.id, folders: [folder] };
  }

  const rawFolders = Array.isArray(rawStore?.folders) ? rawStore.folders : [];
  const usedIds = new Set();
  const folders = [];

  for (const rawFolder of rawFolders) {
    if (!rawFolder) continue;

    let id = String(rawFolder.id || makeMessageFolderId());
    if (usedIds.has(id)) id = makeMessageFolderId();
    usedIds.add(id);

    const fallbackName = folders.length ? `Папка сообщений ${folders.length + 1}` : 'Основные сообщения';
    folders.push({
      id,
      name: String(rawFolder.name || fallbackName).trim() || fallbackName,
      variants: sanitizeMessageVariants(rawFolder.variants || rawFolder.messages),
      image: normalizeMessageImage(rawFolder.image),
      createdAt: Number(rawFolder.createdAt || Date.now()),
      updatedAt: Number(rawFolder.updatedAt || Date.now()),
    });
  }

  if (!folders.length) folders.push(defaultMessageFolder(['']));

  const seenNames = new Set();
  for (const folder of folders) {
    const originalName = folder.name;
    let name = originalName;
    let copyIndex = 1;
    while (seenNames.has(String(name).trim().toLocaleLowerCase('ru-RU'))) {
      name = NameUtils.makeCopyName(originalName, copyIndex);
      copyIndex += 1;
    }
    folder.name = name;
    seenNames.add(String(name).trim().toLocaleLowerCase('ru-RU'));
  }

  const activeFolderId = folders.some((folder) => folder.id === rawStore?.activeFolderId)
    ? rawStore.activeFolderId
    : folders[0].id;

  return { version: 2, activeFolderId, folders };
}

function cleanupMessageImages(folders) {
  try {
    ensureDir(MESSAGE_IMAGES_DIR);
    const used = new Set(
      folders
        .map((folder) => folder?.image?.fileName)
        .filter(Boolean)
        .map((fileName) => path.basename(fileName))
    );

    for (const item of fs.readdirSync(MESSAGE_IMAGES_DIR)) {
      if (!used.has(item)) {
        fs.rmSync(path.join(MESSAGE_IMAGES_DIR, item), { force: true });
      }
    }
  } catch (error) {
    logger.error(LOG_CATEGORIES.SYSTEM, 'failed to clean message images', { error });
  }
}

function getMessageStore() {
  const raw = safeReadJson(MESSAGES_FILE, null);
  return normalizeMessageStore(raw);
}

function saveMessageStore(store) {
  ensureDir(MESSAGE_IMAGES_DIR);
  const normalized = normalizeMessageStore(store);

  normalized.folders.forEach((folder, index) => {
    validateSectionName(folder.name, normalized.folders, {
      currentId: folder.id,
      emptyMessage: 'Введите название папки сообщений',
      duplicateMessage: 'Папка с таким названием уже есть',
    });

    folder.name = String(folder.name).trim();
    folder.variants = sanitizeMessageVariants(folder.variants);
    folder.image = normalizeMessageImage(folder.image);
    folder.createdAt = Number(folder.createdAt || Date.now());
    folder.updatedAt = Number(folder.updatedAt || Date.now() + index);
  });

  cleanupMessageImages(normalized.folders);
  safeWriteJson(MESSAGES_FILE, normalized);
  return {
    ...normalized,
    folders: normalized.folders.map(withMessageImagePath),
  };
}

function ensureMessageStore() {
  ensureDir(MESSAGE_IMAGES_DIR);
  if (!fs.existsSync(MESSAGES_FILE)) {
    saveMessageStore({ folders: [defaultMessageFolder([''])] });
    return;
  }

  saveMessageStore(getMessageStore());
}

function getMessageFolderById(folderId, store = getMessageStore()) {
  return store.folders.find((folder) => folder.id === folderId) || null;
}

function createMessageFolder(name) {
  const store = getMessageStore();
  const trimmedName = validateSectionName(name, store.folders, {
    emptyMessage: 'Введите название папки сообщений',
    duplicateMessage: 'Папка с таким названием уже есть',
  });
  const now = Date.now();
  const folder = {
    id: makeMessageFolderId(),
    name: trimmedName,
    variants: [''],
    image: null,
    createdAt: now,
    updatedAt: now,
  };

  store.folders.push(folder);
  store.activeFolderId = folder.id;
  return saveMessageStore(store);
}

function renameMessageFolder(folderId, name) {
  const store = getMessageStore();
  const folder = getMessageFolderById(folderId, store);
  if (!folder) throw new Error('Папка сообщений не найдена');

  folder.name = validateSectionName(name, store.folders, {
    currentId: folderId,
    emptyMessage: 'Введите название папки сообщений',
    duplicateMessage: 'Папка с таким названием уже есть',
  });
  folder.updatedAt = Date.now();
  return saveMessageStore(store);
}

function deleteMessageImageFile(image) {
  const fileName = path.basename(String(image?.fileName || ''));
  if (!fileName) return;

  const filePath = path.resolve(MESSAGE_IMAGES_DIR, fileName);
  const imageDir = path.resolve(MESSAGE_IMAGES_DIR);
  if (!filePath.startsWith(imageDir + path.sep)) return;

  fs.rmSync(filePath, { force: true });
}

function deleteMessageFolder(folderId) {
  const store = getMessageStore();
  if (store.folders.length <= 1) throw new Error('Нельзя удалить последнюю папку сообщений');

  const folder = getMessageFolderById(folderId, store);
  if (!folder) throw new Error('Папка сообщений не найдена');

  deleteMessageImageFile(folder.image);
  store.folders = store.folders.filter((item) => item.id !== folderId);
  if (store.activeFolderId === folderId) store.activeFolderId = store.folders[0]?.id || '';
  return saveMessageStore(store);
}

function setActiveMessageFolder(folderId) {
  const store = getMessageStore();
  if (!getMessageFolderById(folderId, store)) throw new Error('Папка сообщений не найдена');
  store.activeFolderId = folderId;
  return saveMessageStore(store);
}

function copyMessageFolderImage(folderId, sourcePath) {
  const store = getMessageStore();
  const folder = getMessageFolderById(folderId, store);
  if (!folder) throw new Error('Папка сообщений не найдена');

  const ext = path.extname(sourcePath || '').toLowerCase();
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  if (!allowed.has(ext)) throw new Error('Поддерживаются изображения JPG, PNG, GIF и WebP');
  if (!fs.existsSync(sourcePath)) throw new Error('Файл изображения не найден');

  ensureDir(MESSAGE_IMAGES_DIR);
  const nextFileName = `${folder.id}_${Date.now().toString(36)}${ext}`;
  const nextPath = path.join(MESSAGE_IMAGES_DIR, nextFileName);
  fs.copyFileSync(sourcePath, nextPath);
  deleteMessageImageFile(folder.image);

  const stat = fs.statSync(nextPath);
  folder.image = {
    fileName: nextFileName,
    originalName: path.basename(sourcePath),
    size: stat.size,
    updatedAt: Date.now(),
  };
  folder.updatedAt = Date.now();
  return saveMessageStore(store);
}

function deleteMessageFolderImage(folderId) {
  const store = getMessageStore();
  const folder = getMessageFolderById(folderId, store);
  if (!folder) throw new Error('Папка сообщений не найдена');

  deleteMessageImageFile(folder.image);
  folder.image = null;
  folder.updatedAt = Date.now();
  return saveMessageStore(store);
}

function getAccountNumber(accountId) {
  const match = String(accountId || '').match(/(\d+)$/);
  return match ? match[1] : '1';
}

function getAccountSessionDir(accountId) {
  return path.join(USER_DATA, `wa_session_${getAccountNumber(accountId)}`);
}

function getAccountHistoryFile(accountId) {
  return path.join(USER_DATA, `send_history_${getAccountNumber(accountId)}.json`);
}

function getAccountLogsFile(accountId) {
  return path.join(USER_DATA, `logs_${getAccountNumber(accountId)}.txt`);
}

function defaultAccounts() {
  const now = Date.now();
  return ACCOUNT_IDS.map((id, index) => ({
    id,
    name: `WhatsApp ${index + 1}`,
    active: index === 0,
    status: 'offline',
    lastUsedAt: index === 0 ? now : 0,
  }));
}

function normalizeAccount(account, index = 0) {
  const fallback = defaultAccounts()[index] || defaultAccounts()[0];
  const status = ACCOUNT_STATUS_VALUES.has(account?.status) ? account.status : fallback.status;

  return {
    id: String(account?.id || fallback.id),
    name: String(account?.name || fallback.name).trim() || fallback.name,
    active: Boolean(account?.active),
    status,
    lastUsedAt: Number(account?.lastUsedAt || 0),
  };
}

function getStoredAccounts() {
  const raw = safeReadJson(ACCOUNTS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function saveStoredAccounts(accounts) {
  const normalized = Array.isArray(accounts)
    ? accounts
        .filter(Boolean)
        .map((account, index) => normalizeAccount(account, index))
        .slice(0, ACCOUNT_IDS.length)
    : defaultAccounts();

  ensureDir(USER_DATA);
  safeWriteJson(ACCOUNTS_FILE, normalized);
  return normalized;
}

function getAccountById(accountId, accounts = getStoredAccounts()) {
  return accounts.find((account) => account.id === accountId) || null;
}

function resolveAccountId(accountId, accounts = getStoredAccounts()) {
  if (getAccountById(accountId, accounts)) return String(accountId);
  return accounts.find((account) => account.active)?.id || accounts[0]?.id || ACCOUNT_IDS[0];
}

function updateAccountMeta(accountId, patch = {}) {
  const accounts = getStoredAccounts();
  const resolvedId = resolveAccountId(accountId, accounts);
  const nextAccounts = accounts.map((account) =>
    account.id === resolvedId ? { ...account, ...patch } : account
  );

  saveStoredAccounts(nextAccounts);
  return getAccountById(resolvedId, nextAccounts);
}

function setActiveAccount(accountId) {
  const accounts = getStoredAccounts();
  const resolvedId = resolveAccountId(accountId, accounts);
  const now = Date.now();
  const nextAccounts = accounts.map((account) => ({
    ...account,
    active: account.id === resolvedId,
    lastUsedAt: account.id === resolvedId ? now : account.lastUsedAt,
  }));

  saveStoredAccounts(nextAccounts);
  return getAccountById(resolvedId, nextAccounts);
}

function renameAccount(accountId, name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) throw new Error('Введите название аккаунта');
  return updateAccountMeta(accountId, { name: trimmedName });
}

function migrateLegacyAccountArtifacts(accountId) {
  if (accountId !== 'wa_1') return;

  const sessionDir = getAccountSessionDir(accountId);
  if (!fs.existsSync(sessionDir) && fs.existsSync(LEGACY_SESSION_DIR)) {
    fs.cpSync(LEGACY_SESSION_DIR, sessionDir, { recursive: true });
  }

  const historyFile = getAccountHistoryFile(accountId);
  if (!fs.existsSync(historyFile) && fs.existsSync(LEGACY_HISTORY_FILE)) {
    fs.copyFileSync(LEGACY_HISTORY_FILE, historyFile);
  }

  const logsFile = getAccountLogsFile(accountId);
  if (!fs.existsSync(logsFile) && fs.existsSync(LEGACY_LOGS_FILE)) {
    fs.copyFileSync(LEGACY_LOGS_FILE, logsFile);
  }
}

function ensureAccountRuntimeFiles(accountId) {
  const sessionDir = getAccountSessionDir(accountId);
  const historyFile = getAccountHistoryFile(accountId);
  const logsFile = getAccountLogsFile(accountId);

  ensureDir(sessionDir);

  if (!fs.existsSync(historyFile)) safeWriteJson(historyFile, {});
  if (!fs.existsSync(logsFile)) fs.writeFileSync(logsFile, '');
}

function ensureAccountStore() {
  ensureDir(USER_DATA);

  const rawAccounts = getStoredAccounts();
  const nextAccounts = [];
  const seenIds = new Set();

  ACCOUNT_IDS.forEach((accountId, index) => {
    const fromFile = rawAccounts.find((account) => account?.id === accountId);
    const normalized = normalizeAccount({ ...fromFile, id: accountId }, index);
    if (seenIds.has(normalized.id)) return;
    seenIds.add(normalized.id);
    nextAccounts.push(normalized);
  });

  if (!nextAccounts.some((account) => account.active) && nextAccounts[0]) {
    nextAccounts[0].active = true;
  }

  saveStoredAccounts(nextAccounts);

  nextAccounts.forEach((account) => {
    migrateLegacyAccountArtifacts(account.id);
    ensureAccountRuntimeFiles(account.id);
  });
}

function listAccounts() {
  ensureAccountStore();
  return getStoredAccounts().map((account, index) => {
    const normalized = normalizeAccount(account, index);
    return {
      ...normalized,
      sessionDir: getAccountSessionDir(normalized.id),
    };
  });
}

function emitToRenderer(channel, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, data);
}

function getUpdateSnapshot(status = 'idle', extra = {}) {
  return {
    status,
    flowState: updateFlowState,
    version: app.getVersion(),
    updateVersion: pendingUpdateInfo?.version || '',
    releaseNotes: pendingUpdateInfo?.releaseNotes || pendingUpdateInfo?.releaseName || '',
    downloaded: updateDownloaded,
    ...extra,
  };
}

function isUpdatePublishMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('your_github_org') ||
    message.includes('404') ||
    message.includes('latest.yml') ||
    message.includes('latest-mac.yml') ||
    message.includes('latest-linux.yml') ||
    message.includes('no published versions') ||
    message.includes('cannot find channel') ||
    message.includes('repository') ||
    message.includes('release')
  );
}

function setupAutoUpdater() {
  if (!autoUpdater || updaterListenersReady) return;
  autoUpdater.removeAllListeners();
  updaterListenersReady = true;

  // Нельзя менять имя exe вручную — это ломает обновления.
  // Имя установщика задаётся только через build.artifactName в package.json.
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    updateFlowState = 'checking';
    logger.info(LOG_CATEGORIES.SYSTEM, 'update checking', { version: app.getVersion() });
    emitToRenderer('update-event', getUpdateSnapshot('checking'));
  });

  autoUpdater.on('update-available', (info) => {
    pendingUpdateInfo = info || null;
    updateDownloaded = false;
    updateFlowState = 'available';
    logger.info(LOG_CATEGORIES.SYSTEM, 'update available', {
      currentVersion: app.getVersion(),
      updateVersion: info?.version,
      files: info?.files?.map((file) => file?.url || file?.path).filter(Boolean),
      path: info?.path,
    });
    emitToRenderer('update-event', getUpdateSnapshot('available'));
    setTimeout(() => {
      if (updateFlowState !== 'available') return;
      updateFlowState = 'downloading';
      logger.info(LOG_CATEGORIES.SYSTEM, 'update auto download start', {
        updateVersion: pendingUpdateInfo?.version,
        files: pendingUpdateInfo?.files?.map((file) => file?.url || file?.path).filter(Boolean),
        path: pendingUpdateInfo?.path,
      });
      autoUpdater.downloadUpdate().catch((error) => {
        logger.error(LOG_CATEGORIES.SYSTEM, 'update auto download failed', { error });
        updateFlowState = 'error';
        emitToRenderer('update-event', getUpdateSnapshot('download-error', {
          message: error?.message || 'Не удалось скачать обновление. Проверьте интернет или попробуйте позже',
        }));
      });
    }, 350);
  });

  autoUpdater.on('update-not-available', () => {
    pendingUpdateInfo = null;
    updateDownloaded = false;
    updateFlowState = 'idle';
    logger.info(LOG_CATEGORIES.SYSTEM, 'update not available', { version: app.getVersion() });
    emitToRenderer('update-event', getUpdateSnapshot('not-available'));
  });

  autoUpdater.on('download-progress', (progress = {}) => {
    updateFlowState = 'downloading';
    logger.info(LOG_CATEGORIES.SYSTEM, 'update download progress', {
      percent: Math.round(Number(progress.percent) || 0),
      transferred: progress.transferred,
      total: progress.total,
    });
    emitToRenderer('update-event', getUpdateSnapshot('downloading', {
      percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      transferred: progress.transferred,
      total: progress.total,
    }));
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateInfo = info || pendingUpdateInfo;
    updateDownloaded = true;
    updateFlowState = 'downloaded';
    logger.info(LOG_CATEGORIES.SYSTEM, 'update downloaded', {
      updateVersion: info?.version,
      files: info?.files?.map((file) => file?.url || file?.path).filter(Boolean),
      path: info?.path,
    });
    emitToRenderer('update-event', getUpdateSnapshot('downloaded'));
  });

  autoUpdater.on('error', (error) => {
    updateFlowState = 'error';
    logger.error(LOG_CATEGORIES.SYSTEM, 'update error', { error });
    emitToRenderer('update-event', getUpdateSnapshot('error', {
      message: error?.message || 'Не удалось проверить обновления.',
    }));
  });
}

async function checkForUpdates({ manual = false } = {}) {
  if (!autoUpdater) {
    return {
      ok: false,
      status: 'unsupported',
      message: 'Автообновление пока недоступно в этой сборке.',
    };
  }

  if (updateFlowState === 'checking' || updateFlowState === 'downloading') {
    emitToRenderer('update-event', getUpdateSnapshot(updateFlowState, { manual, busy: true }));
    return { ok: false, status: 'busy', flowState: updateFlowState };
  }

  try {
    logger.info(LOG_CATEGORIES.SYSTEM, 'update check started', { version: app.getVersion(), manual });
    updateFlowState = 'checking';
    emitToRenderer('update-event', getUpdateSnapshot('checking', { manual }));
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const status = isUpdatePublishMissing(error) ? 'not-available' : 'error';
    const payload = getUpdateSnapshot(status, {
      manual,
      message: error?.message || 'Не удалось проверить обновления.',
    });
    emitToRenderer('update-event', payload);
    return { ok: false, ...payload };
  }
}

async function closeAccountController(accountId, status = 'offline') {
  const controller = accountControllers.get(accountId);
  if (!controller) {
    updateAccountMeta(accountId, { status });
    return;
  }

  accountControllers.delete(accountId);

  try {
    await controller.close();
  } catch (error) {
    logger.error(LOG_CATEGORIES.WHATSAPP, 'failed to close account controller', { accountId, error });
  } finally {
    updateAccountMeta(accountId, { status });
  }
}

async function closeInactiveControllers(activeAccountId = '') {
  const targets = [...accountControllers.keys()].filter((accountId) => accountId !== activeAccountId);
  for (const accountId of targets) {
    await closeAccountController(accountId);
  }
}

function createAccountController(accountId) {
  const sessionDir = getAccountSessionDir(accountId);
  const controller = new WhatsAppController(
    sessionDir,
    (event, data) => {
      if (event === 'wa-event') {
        if (data?.type === 'connected') {
          updateAccountMeta(accountId, { status: 'connected', lastUsedAt: Date.now() });
        } else if (data?.type === 'opened' || data?.type === 'timeout') {
          updateAccountMeta(accountId, { status: 'loading', lastUsedAt: Date.now() });
        }
      }

      emitToRenderer(event, { ...(data || {}), accountId });
    },
    { accountId }
  );

  accountControllers.set(accountId, controller);
  return controller;
}

async function getAccountController(accountId, { create = false, exclusive = false, activate = true } = {}) {
  ensureAccountStore();

  const resolvedAccountId = resolveAccountId(accountId);
  if (activate) {
    setActiveAccount(resolvedAccountId);
  }
  if (exclusive) {
    await closeInactiveControllers(resolvedAccountId);
  }

  if (accountControllers.has(resolvedAccountId)) {
    return accountControllers.get(resolvedAccountId);
  }

  if (!create) return null;

  ensureAccountRuntimeFiles(resolvedAccountId);
  return createAccountController(resolvedAccountId);
}

async function getAccountStatus(accountId) {
  const resolvedAccountId = resolveAccountId(accountId);
  const controller = accountControllers.get(resolvedAccountId);

  if (!controller) {
    return getAccountById(resolvedAccountId)?.status || 'offline';
  }

  try {
    const status = await controller.checkStatus();
    updateAccountMeta(resolvedAccountId, { status, lastUsedAt: Date.now() });
    return status;
  } catch (error) {
    logger.error(LOG_CATEGORIES.WHATSAPP, 'failed to get account status', { accountId: resolvedAccountId, error });
    updateAccountMeta(resolvedAccountId, { status: 'error' });
    return 'error';
  }
}

function parseAccountPayload(accountIdOrPayload, maybePayload) {
  if (typeof accountIdOrPayload === 'string') {
    return { accountId: accountIdOrPayload, payload: maybePayload || {} };
  }

  if (accountIdOrPayload && typeof accountIdOrPayload === 'object' && !Array.isArray(accountIdOrPayload)) {
    return {
      accountId: accountIdOrPayload.accountId || null,
      payload: accountIdOrPayload,
    };
  }

  return {
    accountId: null,
    payload: maybePayload || accountIdOrPayload || {},
  };
}

function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < String(line || '').length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(value.trim());
      value = '';
      continue;
    }

    value += char;
  }

  result.push(value.trim());
  return result;
}

function parseContactsCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error('Файл пуст');

  const commaCount = (lines[0].match(/,/g) || []).length;
  const semicolonCount = (lines[0].match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  const header = parseCsvLine(lines[0], delimiter).map((item) => item.toLowerCase().trim());
  const findColumnIndex = (names) =>
    names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;

  const nameIndex = findColumnIndex(['имя', 'name']);
  const phoneIndex = findColumnIndex(['телефон', 'phone', 'номер', 'number']);
  if (phoneIndex === -1) throw new Error('Колонка "Телефон" не найдена');

  const imported = [];
  let skippedInvalid = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const parts = parseCsvLine(lines[index], delimiter);
    const phone = parts[phoneIndex] || '';
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      skippedInvalid += 1;
      continue;
    }

    const displayPhone = `+${normalizedPhone}`;
    const name = nameIndex >= 0 ? parts[nameIndex] || displayPhone : displayPhone;

    imported.push(normalizeContact({
      name: String(name || normalizedPhone).trim() || normalizedPhone,
      phone: displayPhone,
      source: 'import',
    }, 'import'));
  }

  const stats = dedupeContacts(imported);
  logger.info(LOG_CATEGORIES.CACHE, 'contacts import csv parsed', {
    file: path.basename(filePath),
    rows: Math.max(lines.length - 1, 0),
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    duplicates: stats.duplicates,
    skippedInvalid,
  });
  return {
    contacts: stats.contacts,
    found: stats.totalBefore + skippedInvalid,
    imported: stats.totalAfter,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    duplicates: stats.duplicates,
    skippedInvalid,
  };
}

function parseContactsJson(filePath) {
  const raw = safeReadJson(filePath, null);
  const list = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.contacts) ? raw.contacts : []);
  if (!list.length) throw new Error('В JSON не найдены контакты');

  let skippedInvalid = 0;
  const imported = [];
  for (const item of list) {
    const contact = normalizeContact(item, 'import');
    if (!contact.normalizedPhone) {
      skippedInvalid += 1;
      continue;
    }
    imported.push({ ...contact, source: 'import' });
  }

  const stats = dedupeContacts(imported);
  logger.info(LOG_CATEGORIES.CACHE, 'contacts import json parsed', {
    file: path.basename(filePath),
    rows: list.length,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    duplicates: stats.duplicates,
    skippedInvalid,
  });
  return {
    contacts: stats.contacts,
    found: stats.totalBefore + skippedInvalid,
    imported: stats.totalAfter,
    totalBefore: stats.totalBefore,
    totalAfter: stats.totalAfter,
    duplicates: stats.duplicates,
    skippedInvalid,
  };
}

function parseContactsFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return parseContactsJson(filePath);
  if (ext === '.csv') return parseContactsCsv(filePath);
  if (ext === '.xls' || ext === '.xlsx') {
    throw new Error('Excel-файл пока нельзя прочитать напрямую. Сохраните его как CSV и импортируйте снова.');
  }
  throw new Error('Поддерживаются CSV и JSON');
}

function ensureFiles() {
  ensureDir(USER_DATA);
  ensureDir(DATA_DIR);
  ensureDir(getLogDirectory());
  if (!fs.existsSync(CONFIG_FILE)) writeAppConfig({});
  ensureBaseStore();
  ensureAccountStore();
  ensureMessageStore();
  if (!fs.existsSync(AI_MEMORY_FILE)) writeAiMemory({ liked: [], disliked: [] });
  if (!fs.existsSync(COLLECT_PROGRESS_FILE)) writeCollectProgress({ bases: {} });
  if (!fs.existsSync(GLOBAL_SEND_HISTORY_FILE)) safeWriteJson(GLOBAL_SEND_HISTORY_FILE, {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#FAFAFA',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => checkForUpdates({ manual: false }), 2500);
  });
}

app.whenReady().then(() => {
  ensureFiles();
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  for (const accountId of [...accountControllers.keys()]) {
    await closeAccountController(accountId);
  }
  app.quit();
});

function getCacheStateForDiagnostics() {
  return {
    billzDiagnosticsAvailable: Boolean(lastBillzDiagnostics),
    billzDiagnosticsAt: lastBillzDiagnostics?.checkedAt || lastBillzDiagnostics?.updatedAt || '',
    aiSandboxHistory: aiSandboxHistory.length,
    lastAiDebugState,
  };
}

function getWhatsAppSessionStateForDiagnostics() {
  const active = [...accountControllers.entries()].map(([accountId, controller]) => ({
    accountId,
    hasBrowser: Boolean(controller?.browser),
    hasPage: Boolean(controller?.page),
  }));
  return {
    activeCount: active.length,
    active,
  };
}

async function getDebugDiagnostics() {
  return buildDiagnostics({
    getBillzStatus,
    hasOpenRouterApiKey,
    getCacheState: getCacheStateForDiagnostics,
    getAiMemory: () => ({ sandbox: aiSandboxMemory, conversation: aiConversationMemory.getState() }),
    getWhatsAppSessionState: getWhatsAppSessionStateForDiagnostics,
    getFeatureFlags,
    getLogDirectory,
  });
}

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', async () => {
  for (const accountId of [...accountControllers.keys()]) {
    await closeAccountController(accountId);
  }
  app.quit();
});

ipcMain.handle('accounts-list', () => {
  try {
    return listAccounts();
  } catch (error) {
    logger.error(LOG_CATEGORIES.IPC, 'failed to list accounts', { error });
    return defaultAccounts();
  }
});

ipcMain.handle('account-set-active', async (_, accountId) => {
  try {
    const account = setActiveAccount(accountId);
    await closeInactiveControllers(account.id);
    return { ok: true, account, accounts: listAccounts() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('account-rename', async (_, payload) => {
  try {
    const account = renameAccount(payload?.id, payload?.name);
    return { ok: true, account, accounts: listAccounts() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('account-disconnect', async (_, accountId) => {
  try {
    const resolvedAccountId = resolveAccountId(accountId);
    await closeAccountController(resolvedAccountId);
    return { ok: true, accountId: resolvedAccountId, accounts: listAccounts() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('wa-open', async (_, accountIdOrPayload) => {
  try {
    const { accountId } = parseAccountPayload(accountIdOrPayload);
    const resolvedAccountId = resolveAccountId(accountId);
    const controller = await getAccountController(resolvedAccountId, {
      create: true,
      exclusive: true,
      activate: true,
    });

    await controller.launch();
    updateAccountMeta(resolvedAccountId, { status: 'loading', lastUsedAt: Date.now() });
    return { ok: true, accountId: resolvedAccountId };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('wa-status', async (_, accountIdOrPayload) => {
  try {
    const { accountId } = parseAccountPayload(accountIdOrPayload);
    return await getAccountStatus(accountId);
  } catch (error) {
    logger.error(LOG_CATEGORIES.WHATSAPP, 'failed to check WhatsApp status', { error });
    return 'error';
  }
});

ipcMain.handle('wa-collect', async (_, accountIdOrPayload, maybeOpts) => {
  const { accountId, payload: opts } = parseAccountPayload(accountIdOrPayload, maybeOpts);
  const controller = await getAccountController(accountId, {
    create: false,
    exclusive: true,
    activate: true,
  });
  if (!controller) return { ok: false, error: 'WhatsApp аккаунт не открыт' };

  try {
    const resolvedAccountId = resolveAccountId(accountId);
    const baseId = opts?.baseId || opts?.baseType || 'main';
    const base = getBaseById(baseId);
    if (!base) return { ok: false, error: 'Выбранная база не найдена' };

    const contactsFile = getBaseFilePath(base);
    const mode = opts?.mode === 'reset' ? 'reset' : 'continue';
    const targetCount = Math.max(1, parseInt(opts?.targetCount, 10) || 1);
    let saved = [];

    if (mode === 'reset') {
      writeBaseContacts(baseId, []);
      setBaseCollectProgress(baseId, {
        lastSeenPhone: '',
        lastSeenName: '',
        lastCollectedAt: '',
        accountId: resolvedAccountId,
      });
    } else {
      saved = getBaseContactsInfo(baseId, { persist: true }).contacts.slice();
    }

    const validationBeforeCollect = validateBase(baseId);
    const { existingPhones, existingNames } = createContactIdentitySets(saved);
    const baseProgress = getBaseCollectProgress(baseId);
    const collectStats = {
      alreadyInBase: saved.length,
      existingPhones: existingPhones.size,
      existingNames: existingNames.size,
      targetCount,
      found: 0,
      added: 0,
      skippedDuplicates: 0,
      errors: 0,
    };
    let pendingSinceSave = 0;
    let lastSaveAt = Date.now();
    let lastSeenPhone = String(baseProgress.lastSeenPhone || '').trim();
    let lastSeenName = String(baseProgress.lastSeenName || '').trim();

    const publicStats = () => ({
      ...collectStats,
      total: saved.length,
      final: saved.length,
      lastSeenPhone,
      lastSeenName,
    });

    const emitCollectStats = () => {
      emitToRenderer('wa-event', {
        type: 'collect-stats',
        accountId: resolvedAccountId,
        stats: publicStats(),
      });
    };

    const saveProgressPatch = () => ({
      lastSeenPhone,
      lastSeenName,
      lastCollectedAt: new Date().toISOString(),
      accountId: resolvedAccountId,
    });

    const flushCollectProgress = (force = false) => {
      const now = Date.now();
      if (!force && pendingSinceSave <= 0) return;
      if (!force && pendingSinceSave < 10 && now - lastSaveAt < 5000) return;
      const stats = dedupeContacts(saved);
      saved.splice(0, saved.length, ...stats.contacts);
      safeWriteJson(contactsFile, stats.contacts);
      setBaseCollectProgress(baseId, saveProgressPatch());
      pendingSinceSave = 0;
      lastSaveAt = now;
      logger.info(LOG_CATEGORIES.WHATSAPP, 'collect save', {
        baseId,
        addedCount: collectStats.added,
        totalCount: stats.totalAfter,
      });
    };

    logger.info(LOG_CATEGORIES.WHATSAPP, 'collect start', {
      baseId,
      mode,
      accountId: resolvedAccountId,
      existingContactsCount: saved.length,
      existingPhonesCount: existingPhones.size,
      existingNamesCount: existingNames.size,
      targetCount,
      validation: validationBeforeCollect,
    });
    emitCollectStats();

    const onContactFound = (contact) => {
      const normalizedContact = normalizeContact(contact, 'whatsapp');
      const phoneKey = normalizedContact.normalizedPhone;
      const nameKey = normalizedContact.normalizedName;
      if (!phoneKey && !nameKey) {
        collectStats.errors += 1;
        logger.info(LOG_CATEGORIES.WHATSAPP, 'collect skip', { phone: normalizedContact.phone || '', name: normalizedContact.name || '', reason: 'invalid' });
        emitCollectStats();
        return { added: false, reason: 'invalid' };
      }
      if (phoneKey && existingPhones.has(phoneKey)) {
        collectStats.skippedDuplicates += 1;
        logger.info(LOG_CATEGORIES.WHATSAPP, 'collect skip', { phone: normalizedContact.phone || '', name: normalizedContact.name || '', reason: 'duplicate-phone' });
        emitCollectStats();
        return { added: false, reason: 'duplicate-phone' };
      }
      if (!phoneKey && nameKey && existingNames.has(nameKey)) {
        collectStats.skippedDuplicates += 1;
        logger.info(LOG_CATEGORIES.WHATSAPP, 'collect skip', { phone: '', name: normalizedContact.name || '', reason: 'duplicate-name' });
        emitCollectStats();
        return { added: false, reason: 'duplicate-name' };
      }

      if (phoneKey) existingPhones.add(phoneKey);
      else if (nameKey) existingNames.add(nameKey);
      saved.push(normalizedContact);
      collectStats.added += 1;
      lastSeenPhone = String(normalizedContact.phone || lastSeenPhone || '').trim();
      lastSeenName = String(normalizedContact.name || lastSeenName || '').trim();
      pendingSinceSave += 1;
      logger.info(LOG_CATEGORIES.WHATSAPP, 'collect add', { phone: normalizedContact.phone || '', name: normalizedContact.name || '' });
      emitCollectStats();
      try { flushCollectProgress(false); } catch (error) { logger.error(LOG_CATEGORIES.WHATSAPP, 'collect batch save failed', { error }); }
      return { added: true, contact: normalizedContact };
    };

    const onProgress = (progress = {}) => {
      const nextPhone = String(progress.lastSeenPhone || progress.lastParsedPhone || '').trim();
      const nextName = String(progress.lastSeenName || progress.lastParsedName || '').trim();
      if (nextPhone) {
        lastSeenPhone = nextPhone;
      }
      if (nextName) {
        lastSeenName = nextName;
      }
      let statsChanged = false;
      if (progress.type === 'seen') {
        collectStats.found += 1;
        statsChanged = true;
      }
      if (progress.type === 'duplicate') {
        collectStats.skippedDuplicates += 1;
        statsChanged = true;
        logger.info(LOG_CATEGORIES.WHATSAPP, 'collect skip', { phone: progress.phone || '', name: nextName || '', reason: progress.reason || 'duplicate' });
      }
      if (progress.type === 'error') {
        collectStats.errors += 1;
        statsChanged = true;
      }
      if (statsChanged) emitCollectStats();
      try {
        flushCollectProgress(false);
      } catch (error) {
        logger.error(LOG_CATEGORIES.WHATSAPP, 'collect progress save failed', { error });
      }
    };

    const collectResult = await controller.collectContacts({
      ...opts,
      targetCount,
      mode,
      collectMeta: baseProgress,
      existingContacts: [],
      initialStats: publicStats(),
      onContactFound,
      onProgress,
    });
    const stopped = Boolean(collectResult?.stopped);
    flushCollectProgress(true);
    const finalStats = dedupeContacts(saved);
    safeWriteJson(contactsFile, finalStats.contacts);
    setBaseCollectProgress(baseId, saveProgressPatch());
    touchBase(baseId);
    updateAccountMeta(resolvedAccountId, { lastUsedAt: Date.now() });
    logger.info(LOG_CATEGORIES.WHATSAPP, 'collect finish', {
      baseId,
      found: collectStats.found,
      added: collectStats.added,
      skipped: collectStats.skippedDuplicates,
      errors: collectStats.errors,
      totalCount: finalStats.totalAfter,
    });
    emitCollectStats();

    return {
      ok: true,
      contacts: readContactsFromFile(contactsFile),
      accountId: resolvedAccountId,
      collectProgress: getBaseCollectProgress(baseId),
      stopped,
      loadStats: {
        total: finalStats.totalBefore,
        totalBefore: finalStats.totalBefore,
        totalAfter: finalStats.totalAfter,
        removedDuplicates: finalStats.duplicates,
        removedByPhone: finalStats.removedByPhone,
        removedByName: finalStats.removedByName,
        removedInvalid: finalStats.removedInvalid,
        removed: finalStats.removed,
        final: finalStats.totalAfter,
        alreadyInBase: collectStats.alreadyInBase,
        existingPhones: collectStats.existingPhones,
        existingNames: collectStats.existingNames,
        targetCount,
        found: collectStats.found,
        added: collectStats.added,
        skippedDuplicates: collectStats.skippedDuplicates,
        errors: collectStats.errors,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai-feedback-save', (_, payload) => {
  try {
    return { ok: true, memory: rememberAiFeedback(payload) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai-config-status', () => ({
  ok: true,
  connected: hasOpenRouterApiKey(),
}));

ipcMain.handle('ai-config-save-key', async (_, payload) => {
  try {
    return await saveOpenRouterApiKey(payload?.key || payload);
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('billz-config-status', () => getBillzStatus());

ipcMain.handle('billz-config-save-key', async (_, payload) => {
  try {
    return await saveBillzSecretToken(payload);
  } catch (error) {
    return {
      ok: false,
      connected: false,
      status: 'error',
      error: normalizeBillzError(error, error?.status),
    };
  }
});

ipcMain.handle('billz-check-connection', async () => {
  const startedAt = Date.now();
  try {
    const result = await checkSavedBillzConnection();
    logger.performance('BILLZ connection check', startedAt, { ok: result.ok, status: result.status });
    return result;
  } catch (error) {
    logger.error(LOG_CATEGORIES.BILLZ, 'BILLZ connection check failed', { error });
    return {
      ok: false,
      connected: false,
      status: 'error',
      error: normalizeBillzError(error, error?.status),
    };
  }
});

ipcMain.handle('billz-run-diagnostics', async () => {
  const startedAt = Date.now();
  try {
    const result = await runSavedBillzDiagnostics();
    logger.performance('BILLZ diagnostics', startedAt, { ok: result.ok, endpoints: result.endpoints?.length || 0 });
    return result;
  } catch (error) {
    logger.error(LOG_CATEGORIES.BILLZ, 'diagnostics failed', { code: error?.code || error?.message || 'unknown', error });
    return {
      ok: false,
      connected: false,
      status: 'error',
      error: normalizeBillzError(error, error?.status),
      endpoints: [],
    };
  }
});

ipcMain.handle('billz-search-products', async (_, payload) => {
  const startedAt = Date.now();
  try {
    const result = await searchSavedBillzProducts(payload);
    logger.performance('BILLZ product search', startedAt, {
      ok: result.ok,
      query: String(payload?.query || '').slice(0, 120),
      matches: result.products?.length || 0,
      searchMode: result.searchMode || '',
    });
    return result;
  } catch (error) {
    logger.error(LOG_CATEGORIES.BILLZ, 'search failed', { code: error?.code || error?.message || 'unknown', error });
    return {
      ok: false,
      connected: false,
      status: 'error',
      error: normalizeBillzError(error, error?.status),
      errorMessage: error?.message || '',
      errorData: error?.data ?? null,
      products: [],
    };
  }
});

ipcMain.handle('ai-test-chat', async (_, payload) => {
  const startedAt = Date.now();
  try {
    const result = await requestAiTestChat(payload);
    logger.performance('AI test chat', startedAt, { ok: result.ok });
    return result;
  } catch (error) {
    logger.error(LOG_CATEGORIES.AI, 'AI test chat request failed', { error });
    return { ok: false, error: normalizeOpenRouterError(error) };
  }
});

ipcMain.handle('wa-collect-stop', async (_, accountIdOrPayload) => {
  const { accountId } = parseAccountPayload(accountIdOrPayload);
  const controller = await getAccountController(accountId, { create: false, activate: false });
  if (controller) controller.stopCollect();
  return true;
});

ipcMain.handle('bases-list', () => {
  try {
    ensureBaseStore();
    return listBases();
  } catch (error) {
    logger.error(LOG_CATEGORIES.IPC, 'failed to list bases', { error });
    return [];
  }
});

ipcMain.handle('base-create', (_, name) => {
  try {
    const base = createBase(name);
    return { ok: true, base, bases: listBases() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('base-rename', (_, payload) => {
  try {
    const base = renameBase(payload?.id, payload?.name);
    return { ok: true, base, bases: listBases() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('base-delete', (_, baseId) => {
  try {
    const bases = deleteBase(baseId);
    return { ok: true, bases };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('contacts-load', (_, baseId = 'main') => {
  try {
    return getBaseContacts(baseId);
  } catch {
    return [];
  }
});

ipcMain.handle('contacts-load-info', (_, baseId = 'main') => {
  try {
    return getBaseContactsInfo(baseId, { persist: true });
  } catch (error) {
    return { ok: false, contacts: [], total: 0, removedDuplicates: 0, removedInvalid: 0, removed: 0, final: 0, error: error.message };
  }
});

ipcMain.handle('contacts-save', (_, contacts, baseId = 'main') => {
  const stats = writeBaseContacts(baseId, contacts);
  return { ok: true, ...stats };
});

ipcMain.handle('contacts-dedupe', (_, baseId = 'main') => {
  try {
    return dedupeBaseContacts(baseId);
  } catch (error) {
    return { ok: false, contacts: [], total: 0, removedDuplicates: 0, removedByPhone: 0, removedByName: 0, removedInvalid: 0, removed: 0, final: 0, error: error.message };
  }
});

ipcMain.handle('contacts-validate-base', (_, baseId = 'main') => {
  try {
    return validateBase(baseId);
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('contacts-export-csv', async (_, payload) => {
  const contacts = Array.isArray(payload) ? payload : payload?.contacts;
  const base = getBaseById(payload?.baseId);
  const baseName = validateSectionName(payload?.baseName || base?.name || 'База контактов', [], {
    emptyMessage: 'Введите название базы',
  });
  const defaultPath = uniquePathInDirectory(app.getPath('downloads'), baseName, 'csv');

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить контакты',
    defaultPath,
    filters: [{ name: 'CSV файл', extensions: ['csv'] }],
  });

  if (!filePath) return { ok: false, cancelled: true };
  if (!(await confirmOverwrite(filePath))) return { ok: false, cancelled: true };

  try {
    const csv =
      'Имя,Телефон,Источник\n' +
      sanitizeContacts(contacts)
        .map((contact) => `"${(contact.name || '').replace(/"/g, '""')}","${contact.phone || ''}","${contact.source || ''}"`)
        .join('\n');

    fs.writeFileSync(filePath, `\uFEFF${csv}`);
    shell.showItemInFolder(filePath);
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('contacts-export-json', async (_, payload) => {
  const contacts = Array.isArray(payload) ? payload : payload?.contacts;
  const base = getBaseById(payload?.baseId);
  const baseName = validateSectionName(payload?.baseName || base?.name || 'База контактов', [], {
    emptyMessage: 'Введите название базы',
  });
  const defaultPath = uniquePathInDirectory(app.getPath('downloads'), baseName, 'json');

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить в JSON',
    defaultPath,
    filters: [{ name: 'JSON файл', extensions: ['json'] }],
  });

  if (!filePath) return { ok: false, cancelled: true };
  if (!(await confirmOverwrite(filePath))) return { ok: false, cancelled: true };

  try {
    fs.writeFileSync(filePath, JSON.stringify(sanitizeContacts(contacts), null, 2));
    shell.showItemInFolder(filePath);
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('contacts-import-csv', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Импорт контактов',
    filters: [
      { name: 'Контакты', extensions: ['csv', 'json', 'xlsx', 'xls'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  });

  if (!filePaths || !filePaths[0]) return { ok: false };

  try {
    const filePath = filePaths[0];
    const parsed = parseContactsFile(filePath);
    const importId = `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const fileTitle = path.basename(filePath, path.extname(filePath));
    const suggestedName = NameUtils.shortenText(`Импорт — ${fileTitle}`, 80);

    pendingImports.set(importId, {
      ...parsed,
      filePath,
      fileName: path.basename(filePath),
      suggestedName,
      createdAt: Date.now(),
    });

    return {
      ok: true,
      importId,
      fileName: path.basename(filePath),
      suggestedName,
      found: parsed.found,
      imported: parsed.imported,
      totalBefore: parsed.totalBefore,
      totalAfter: parsed.totalAfter,
      duplicates: parsed.duplicates,
      skippedInvalid: parsed.skippedInvalid,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('contacts-import-confirm', (_, payload) => {
  try {
    const importId = payload?.importId;
    const pending = pendingImports.get(importId);
    if (!pending) throw new Error('Данные импорта устарели. Выберите файл заново.');

    let base;
    let contacts;
    let addedNew = pending.contacts.length;
    let skippedDuplicates = pending.duplicates || 0;

    if (payload?.baseId) {
      base = getBaseById(payload.baseId);
      if (!base) throw new Error('База не найдена');
      const before = getBaseContacts(base.id);
      const beforeKeys = new Set(before.map((contact) => normalizePhone(contact.normalizedPhone) || normalizePhone(contact.phone)).filter(Boolean));
      const incomingNew = [];
      const incomingKeys = new Set();
      for (const contact of pending.contacts) {
        const key = normalizePhone(contact?.normalizedPhone) || normalizePhone(contact?.phone);
        if (!key || beforeKeys.has(key) || incomingKeys.has(key)) continue;
        incomingKeys.add(key);
        incomingNew.push(contact);
      }
      addedNew = incomingNew.length;
      skippedDuplicates = pending.contacts.length - incomingNew.length + (pending.duplicates || 0);
      const writeStats = writeBaseContacts(base.id, [...before, ...incomingNew]);
      contacts = getBaseContacts(base.id);
      base = listBases().find((item) => item.id === base.id) || base;
      logger.info(LOG_CATEGORIES.CACHE, 'contacts import merged', {
        baseId: base.id,
        imported: pending.contacts.length,
        addedNew,
        skippedDuplicates,
        totalAfter: writeStats.final,
      });
    } else {
      base = createBaseWithContacts(payload?.baseName || pending.suggestedName, pending.contacts);
      contacts = getBaseContacts(base.id);
      logger.info(LOG_CATEGORIES.CACHE, 'contacts import created base', {
        baseId: base.id,
        imported: pending.contacts.length,
        duplicates: pending.duplicates,
      });
    }
    pendingImports.delete(importId);

    return {
      ok: true,
      base,
      bases: listBases(),
      contacts,
      imported: pending.contacts.length,
      duplicates: pending.duplicates,
      addedNew,
      skippedDuplicates,
      final: contacts.length,
      skippedInvalid: pending.skippedInvalid || 0,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('messages-load', () => {
  try {
    return saveMessageStore(getMessageStore());
  } catch (error) {
    return { version: 2, activeFolderId: 'default', folders: [withMessageImagePath(defaultMessageFolder(['']))], error: error.message };
  }
});

ipcMain.handle('messages-save', (_, store) => {
  try {
    const saved = saveMessageStore(store);
    return { ok: true, store: saved };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-create', (_, name) => {
  try {
    return { ok: true, store: createMessageFolder(name) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-rename', (_, payload) => {
  try {
    return { ok: true, store: renameMessageFolder(payload?.id, payload?.name) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-delete', (_, folderId) => {
  try {
    return { ok: true, store: deleteMessageFolder(folderId) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-active', (_, folderId) => {
  try {
    return { ok: true, store: setActiveMessageFolder(folderId) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-image-select', async (_, folderId) => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Выбрать изображение для папки сообщений',
    filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile'],
  });

  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true };

  try {
    return { ok: true, store: copyMessageFolderImage(folderId, filePaths[0]) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('message-folder-image-delete', (_, folderId) => {
  try {
    return { ok: true, store: deleteMessageFolderImage(folderId) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('openrouter-generate', async (_, payload) => {
  const startedAt = Date.now();
  try {
    const result = await requestOpenRouterChat(payload);
    logger.performance('OpenRouter generate', startedAt, { ok: result.ok, mode: payload?.mode || 'create' });
    return result;
  } catch (error) {
    logger.error(LOG_CATEGORIES.AI, 'OpenRouter request failed', { error });
    return { ok: false, error: normalizeOpenRouterError(error) };
  }
});

ipcMain.handle('history-load', (_, accountIdOrPayload) => {
  try {
    const { accountId } = parseAccountPayload(accountIdOrPayload);
    const resolvedAccountId = resolveAccountId(accountId);
    const history = JSON.parse(fs.readFileSync(getAccountHistoryFile(resolvedAccountId), 'utf8'));
    const normalized = {};

    for (const [phone, meta] of Object.entries(history || {})) {
      const phoneKey = normalizePhoneKey(phone);
      if (!phoneKey) continue;
      normalized[phoneKey] = meta;
    }

    return normalized;
  } catch {
    return {};
  }
});

ipcMain.handle('select-image', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Выбрать изображение',
    filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile'],
  });

  if (!filePaths || !filePaths[0]) return { ok: false };
  return { ok: true, path: filePaths[0] };
});

ipcMain.handle('wa-send', async (_, accountIdOrPayload, maybePayload) => {
  const startedAt = Date.now();
  const { accountId, payload } = parseAccountPayload(accountIdOrPayload, maybePayload);
  const controller = await getAccountController(accountId, {
    create: false,
    exclusive: true,
    activate: true,
  });
  if (!controller) return { ok: false, error: 'WhatsApp аккаунт не открыт' };

  const resolvedAccountId = resolveAccountId(accountId);
  const historyFile = getAccountHistoryFile(resolvedAccountId);
  const logsFile = getAccountLogsFile(resolvedAccountId);
  let baseRemovedDuplicates = 0;
  if (payload?.baseId) {
    try {
      const baseInfo = getBaseContactsInfo(payload.baseId, { persist: true });
      baseRemovedDuplicates = Number(baseInfo.removedDuplicates || 0);
    } catch (error) {
      logger.warn(LOG_CATEGORIES.WHATSAPP, 'send base sanitize skipped', { error: error?.message || error });
    }
  }
  const contactsStats = dedupeContacts(Array.isArray(payload?.contacts) ? payload.contacts : []);
  const contacts = contactsStats.contacts;
  const removedBeforeSend = Math.max(baseRemovedDuplicates, contactsStats.removed || 0);
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const opts = payload?.opts || {};
  if (opts.imagePath && !fs.existsSync(opts.imagePath)) {
    return { ok: false, error: 'Файл изображения не найден' };
  }
  logger.info(LOG_CATEGORIES.WHATSAPP, 'send recipients prepared', {
    accountId: resolvedAccountId,
    baseId: payload?.baseId || '',
    totalBefore: contactsStats.totalBefore,
    finalRecipients: contacts.length,
    removedBeforeSend,
    repeatMode: opts.repeatMode || 'skip-ever',
  });

  const accountHistory = readNormalizedSendHistory(historyFile);
  const globalHistory = readNormalizedSendHistory(GLOBAL_SEND_HISTORY_FILE);
  const repeatMode = ['allow', 'skip-days', 'skip-ever'].includes(opts.repeatMode) ? opts.repeatMode : 'skip-ever';
  opts.repeatMode = repeatMode;
  const history = repeatMode === 'allow' ? {} : mergeSendHistories(globalHistory, accountHistory);

  const result = await controller.sendMessages({
    contacts,
    messages,
    opts,
    history,
    onProgress: (data) => {
      emitToRenderer('send-progress', { ...data, accountId: resolvedAccountId });

      if (!opts.testMode && data.type === 'sent' && data.phone) {
        const phoneKey = normalizePhoneKey(data.phone);
        if (!phoneKey) return;

        history[phoneKey] = {
          phone: data.phone,
          accountId: resolvedAccountId,
          date: new Date().toISOString(),
          lastSent: Date.now(),
          count: (history[phoneKey]?.count || 0) + 1,
        };

        try {
          accountHistory[phoneKey] = history[phoneKey];
          globalHistory[phoneKey] = {
            ...history[phoneKey],
            baseId: payload?.baseId || '',
          };
          writeNormalizedSendHistory(historyFile, accountHistory);
          writeNormalizedSendHistory(GLOBAL_SEND_HISTORY_FILE, globalHistory);
        } catch {}
      }
    },
    onLog: (line) => {
      try {
        fs.appendFileSync(logsFile, `[${new Date().toISOString()}] ${line}\n`);
      } catch {}
    },
  });

  updateAccountMeta(resolvedAccountId, { lastUsedAt: Date.now() });
  logger.performance('WhatsApp send', startedAt, {
    ok: result.ok,
    accountId: resolvedAccountId,
    finalRecipients: contacts.length,
  });
  return { ...result, accountId: resolvedAccountId, removedBeforeSend, finalRecipients: contacts.length };
});

ipcMain.handle('wa-stop', async (_, accountIdOrPayload) => {
  const { accountId } = parseAccountPayload(accountIdOrPayload);
  const controller = await getAccountController(accountId, { create: false, activate: false });
  if (controller) controller.stopFlag = true;
  return true;
});

ipcMain.handle('open-logs', (_, accountIdOrPayload) => {
  const { accountId } = parseAccountPayload(accountIdOrPayload);
  const resolvedAccountId = resolveAccountId(accountId);
  return shell.openPath(getAccountLogsFile(resolvedAccountId));
});
ipcMain.handle('open-data-folder', () => shell.openPath(USER_DATA));
ipcMain.handle('app-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  dataPath: USER_DATA,
  logPath: getLogDirectory(),
  featureFlags: getFeatureFlags(),
}));
ipcMain.handle('debug-read-logs', async (_, payload = {}) => {
  try {
    return {
      ok: true,
      logs: readRecentLogs({ limit: payload?.limit || 250 }),
      logPath: getLogDirectory(),
    };
  } catch (error) {
    logger.error(LOG_CATEGORIES.IPC, 'debug-read-logs failed', { error });
    return { ok: false, logs: [], error: error?.message || 'debug-read-logs-failed' };
  }
});
ipcMain.handle('debug-clear-logs', async () => {
  const result = clearLogs();
  logger.info(LOG_CATEGORIES.SYSTEM, 'debug logs cleared', { ok: result.ok });
  return result;
});
ipcMain.handle('debug-export-logs', async () => {
  const logPath = getLogDirectory();
  await shell.openPath(logPath);
  return { ok: true, logPath };
});
ipcMain.handle('debug-diagnostics', async () => {
  try {
    const startedAt = Date.now();
    const diagnostics = await getDebugDiagnostics();
    logger.performance('diagnostics reload', startedAt, { ok: diagnostics.ok });
    return { ok: true, diagnostics };
  } catch (error) {
    logger.error(LOG_CATEGORIES.IPC, 'debug-diagnostics failed', { error });
    return { ok: false, error: error?.message || 'diagnostics-failed' };
  }
});
ipcMain.handle('debug-run-fixtures', async () => {
  try {
    const startedAt = Date.now();
    const qa = runQaFixtures();
    logger.performance('QA fixtures', startedAt, { status: qa.summary?.status, total: qa.summary?.total, failed: qa.summary?.failed });
    return { ok: true, qa };
  } catch (error) {
    logger.error(LOG_CATEGORIES.IPC, 'debug-run-fixtures failed', { error });
    return { ok: false, error: error?.message || 'qa-fixtures-failed' };
  }
});
ipcMain.handle('updates-check', async () => checkForUpdates({ manual: true }));
ipcMain.handle('updates-download', async () => {
  if (!autoUpdater) return { ok: false, status: 'unsupported' };
  if (updateFlowState === 'downloading') {
    return { ok: false, status: 'busy', flowState: updateFlowState };
  }
  try {
    logger.info(LOG_CATEGORIES.SYSTEM, 'update download requested', {
      currentVersion: app.getVersion(),
      updateVersion: pendingUpdateInfo?.version,
      files: pendingUpdateInfo?.files?.map((file) => file?.url || file?.path).filter(Boolean),
      path: pendingUpdateInfo?.path,
    });
    updateFlowState = 'downloading';
    emitToRenderer('update-event', getUpdateSnapshot('downloading', { percent: 0 }));
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    updateFlowState = 'error';
    logger.error(LOG_CATEGORIES.SYSTEM, 'update download failed', { error });
    const payload = getUpdateSnapshot('download-error', {
      message: error?.message || 'Загрузка обновления прервалась.',
    });
    emitToRenderer('update-event', payload);
    return { ok: false, ...payload };
  }
});
ipcMain.handle('updates-install', () => {
  if (!autoUpdater || !updateDownloaded) return { ok: false };
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});
