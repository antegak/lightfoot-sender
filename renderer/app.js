// ─── State ──────────────────────────────────────────────────────
let contacts = [];
let messages = [''];
let messageStore = { version: 2, activeFolderId: '', folders: [] };
let messageFolders = [];
let isSending = false;
let isCollecting = false;
let totalToSend = 0;
let baseUnsaved = false;
let selectedImagePath = null; // copied app-data image for the active message folder
let currentContactsBase = '';
let currentSendBase = '';
let currentMessageFolderId = '';
let bases = [];
let accounts = [];
let currentActiveAccountId = '';
let currentSendAccountId = '';
let isOpeningWhatsApp = false;
let activeSendRunId = 0;
let contactPhoneSet = new Set();
let waStatusPollTimer = null;
const waStatusCheckPromises = new Map();
let collectSessionCurrent = 0;
let collectSessionTarget = 0;
let activeCollectMode = 'continue';
let contactSearchTimer = null;
let testSelectedContacts = [];
let contactSearchIndex = [];
let filteredContactIndices = [];
let contactFilterCacheKey = '';
let contactViewportFrame = 0;
let lastSendLoadInfo = null;
let aiMode = 'create';
let aiIsGenerating = false;
let aiResults = [];
let aiAddedVariantKeys = new Set();
let aiConnected = false;
let lastAiRequestAt = 0;
let billzState = 'disconnected';
let billzExpanded = false;
let billzHasSavedKey = false;
const billzDiagnosticSamples = new Map();
let aiTestIsSending = false;
let aiSandboxMessages = [];
let aiManagerActiveChatId = '';
let aiManagerFilter = 'all';
let aiManagerEnabled = true;
let aiManagerAudioCtx = null;
let aiManagerLastSoundAt = 0;
const aiManagerNotifiedEvents = new Set();
const NEW_FEATURES = ['ai_manager_ui_122'];

const AI_MANAGER_MODES = ['auto', 'suggest', 'handoff'];
const AI_MANAGER_REPLY = 'Да, подскажем по размеру. Напишите длину стопы.';
const AI_MANAGER_MOCK_NAMES = ['Айжан Маматова', 'Данияр Осмонов', 'Элина Токтосунова', 'Руслан Абдылдаев', 'Алина Садыкова', 'Нурбек Ибраев', 'Мээрим Касымова', 'Тимур Акматов'];
const AI_MANAGER_MOCK_MESSAGES = [
  { text: 'Здравствуйте, есть 38 размер?', reply: 'Да, подскажем по размеру. Напишите длину стопы.' },
  { text: 'Можно подобрать кроссовки на каждый день?', reply: 'Да, подберём удобную модель. Подскажите размер и цвет, который нравится.' },
  { text: 'Хочу обменять размер, как лучше сделать?', reply: 'Поняли. Напишите номер заказа и какой размер нужен вместо текущего.' },
  { text: 'Сколько будет доставка по Бишкеку?', reply: 'Доставка по Бишкеку обычно занимает 1 день. Уточните район, и мы подскажем точнее.' },
  { text: 'Есть ли оплата переводом?', reply: 'Да, оплата переводом доступна. После выбора модели отправим реквизиты.' },
  { text: 'Подойдут ли эти ботинки на широкую стопу?', reply: 'Скорее всего да, но лучше сверим по длине стопы и полноте.' },
];
const aiManagerChats = createAiManagerMockChats();
if (!aiManagerActiveChatId) aiManagerActiveChatId = aiManagerChats[0]?.id || '';

const LOG_LIMIT = 100;
const TOAST_LIMIT = 3;
const WA_STATUS_POLL_MS = 5000;
const CONTACT_SEARCH_DEBOUNCE_MS = 300;
const CONTACT_ROW_HEIGHT = 84;
const CONTACT_ROW_HEIGHT_COMPACT = 76;
const CONTACT_VIEW_OVERSCAN = 6;
const NAME_RULES = window.LightFootNameUtils;

const BASE_LABELS = {
  main: 'Основная база',
  new: 'Новая база',
};

function getEl(id) {
  return document.getElementById(id);
}

function normalizePhoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^0\d{9,}$/.test(digits)) return `996${digits.slice(1, 10)}`;
  if (/^996\d{9,}$/.test(digits)) return digits.slice(0, 12);
  return digits;
}

function getAccountById(accountId) {
  return accounts.find((account) => account.id === accountId) || null;
}

function getFirstAccountId() {
  return accounts[0]?.id || '';
}

function resolveAccountId(accountId, fallbackId = '') {
  if (getAccountById(accountId)) return accountId;
  if (getAccountById(fallbackId)) return fallbackId;
  return accounts.find((account) => account.active)?.id || getFirstAccountId();
}

function getSelectedSendAccountId() {
  return getEl('sendAccountId')?.value || currentSendAccountId || currentActiveAccountId || getFirstAccountId();
}

function getAccountLabel(accountId) {
  return getAccountById(accountId)?.name || 'WhatsApp';
}

function getAccountStatusMeta(status) {
  switch (normalizeWhatsAppStatus(status)) {
    case 'connected':
      return { label: 'Подключён', tone: 'success', text: 'Подключён' };
    case 'qr':
      return { label: 'Требуется QR', tone: 'error', text: 'Требуется вход' };
    case 'error':
      return { label: 'Ошибка', tone: 'error', text: 'Ошибка' };
    case 'loading':
      return { label: 'Загрузка', tone: 'warning', text: 'Загрузка' };
    default:
      return { label: 'Не подключён', tone: 'neutral', text: 'Не подключён' };
  }
}

const STORAGE_KEYS = {
  theme: 'lf-theme',
  contactsBase: 'lf-contacts-base',
  sendBase: 'lf-send-base',
  messageFolder: 'lf-message-folder',
  activeAccount: 'lf-active-account',
  sendAccount: 'lf-send-account',
  collectTarget: 'lf-collect-target',
  sendCount: 'lf-send-count',
  sendRepeatMode: 'lf-send-repeat-mode',
  delayMin: 'lf-delay-min',
  delayMax: 'lf-delay-max',
  safeMode: 'lf-safe-mode',
  skipDays: 'lf-skip-days',
  onboardingDone: 'lf-onboarding-done',
  hasSeenOnboarding: 'hasSeenOnboarding',
  lastSeenVersion: 'lf-last-seen-version',
  seenFeatures: 'lf-seen-features',
};

const DEFAULT_LOG_PLACEHOLDER = '[ Ожидание запуска... ]';
const FORBIDDEN_NAME_ERROR = NAME_RULES?.FORBIDDEN_NAME_ERROR || 'В названии нельзя использовать символы: \\ / : * ? " < > |';

function validateNameInput(name, existingItems = [], options = {}) {
  if (NAME_RULES?.validateName) return NAME_RULES.validateName(name, existingItems, options);
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, name: '', error: options.emptyMessage || 'Введите название' };
  if (/[\\/:*?"<>|]/.test(trimmed)) return { ok: false, name: trimmed, error: FORBIDDEN_NAME_ERROR };
  const duplicate = (Array.isArray(existingItems) ? existingItems : []).some((item) => {
    if (options.currentId && typeof item === 'object' && String(item.id || '') === String(options.currentId)) return false;
    const itemName = typeof item === 'string' ? item : item?.name;
    return String(itemName || '').trim().toLocaleLowerCase('ru-RU') === trimmed.toLocaleLowerCase('ru-RU');
  });
  if (duplicate) return { ok: false, name: trimmed, error: options.duplicateMessage || 'Название уже используется' };
  return { ok: true, name: trimmed, error: '' };
}

function setText(id, value) {
  const el = getEl(id);
  if (!el) return;
  el.textContent = value;
}

function setBadge(ids, label, tone = 'neutral') {
  const items = Array.isArray(ids) ? ids : [ids];
  items.forEach((id) => {
    const el = getEl(id);
    if (!el) return;
    el.textContent = label;
    el.dataset.tone = tone;
  });
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createRandomKgPhone(usedPhones = new Set()) {
  const prefixes = ['550', '551', '555', '700', '701', '707', '708', '770', '772', '777', '990', '996'];
  for (let attempt = 0; attempt < 40; attempt++) {
    const digits = `${pickRandom(prefixes)}${String(Math.floor(100000 + Math.random() * 900000))}`;
    const phone = `+996 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    if (!usedPhones.has(phone)) {
      usedPhones.add(phone);
      return phone;
    }
  }
  return `+996 700 ${String(Date.now()).slice(-6)}`;
}

function createAiManagerMockChats() {
  const usedPhones = new Set();
  return AI_MANAGER_MOCK_NAMES
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 6)
    .map((name, index) => {
      const scenario = pickRandom(AI_MANAGER_MOCK_MESSAGES);
      const mode = index === 0 ? 'handoff' : (index === 1 ? 'suggest' : pickRandom(AI_MANAGER_MODES));
      const reply = scenario.reply || AI_MANAGER_REPLY;
      return {
        id: `mock_${index}_${normalizePhoneKey(name).slice(0, 4) || Math.floor(Math.random() * 9999)}`,
        name,
        phone: createRandomKgPhone(usedPhones),
        lastMessage: scenario.text,
        aiReply: reply,
        mode,
        size: String(36 + Math.floor(Math.random() * 8)),
        purchases: pickRandom(['нет покупок', '1 покупка', '2 покупки', '3 покупки', '5 покупок']),
        messages: [
          { from: 'client', text: scenario.text },
          { from: 'ai', text: reply },
        ],
      };
    });
}

function getAiManagerModeMeta(mode) {
  switch (mode) {
    case 'suggest':
      return { label: 'ИИ предлагает ответ', short: 'suggest', title: 'ИИ предлагает ответ', tone: 'warning' };
    case 'handoff':
      return { label: 'Требуется ваш ответ', short: 'handoff', title: 'Требуется ваш ответ', tone: 'danger' };
    default:
      return { label: 'ИИ ответил автоматически', short: 'auto', title: 'ИИ ответил автоматически', tone: 'success' };
  }
}

function getAiManagerActiveChat() {
  return aiManagerChats.find((chat) => chat.id === aiManagerActiveChatId) || aiManagerChats[0];
}

function setAiManagerChatMode(chat, mode) {
  if (!chat) return;
  chat.mode = AI_MANAGER_MODES.includes(mode) ? mode : 'auto';
  const hasAiMessage = chat.messages.some((message) => message.from === 'ai');
  if (!hasAiMessage) chat.messages.push({ from: 'ai', text: chat.aiReply || AI_MANAGER_REPLY });
}

function playAiManagerSound(mode, options = {}) {
  if (!['suggest', 'handoff'].includes(mode)) return;
  const now = Date.now();
  if (!options.force && now - aiManagerLastSoundAt < 1800) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    aiManagerAudioCtx = aiManagerAudioCtx || new AudioContextClass();
    if (aiManagerAudioCtx.state === 'suspended') aiManagerAudioCtx.resume();
    const start = aiManagerAudioCtx.currentTime + 0.02;
    const master = aiManagerAudioCtx.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(mode === 'handoff' ? 0.16 : 0.09, start + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, start + (mode === 'handoff' ? 1.25 : 1.05));
    master.connect(aiManagerAudioCtx.destination);
    const tones = mode === 'handoff'
      ? [{ f: 392, t: 0 }, { f: 523.25, t: 0.28 }, { f: 659.25, t: 0.56 }]
      : [{ f: 659.25, t: 0 }, { f: 783.99, t: 0.22 }, { f: 880, t: 0.44 }];
    tones.forEach((tone) => {
      const osc = aiManagerAudioCtx.createOscillator();
      const gain = aiManagerAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.f, start + tone.t);
      gain.gain.setValueAtTime(0.0001, start + tone.t);
      gain.gain.exponentialRampToValueAtTime(1, start + tone.t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.t + (mode === 'handoff' ? 0.34 : 0.24));
      osc.connect(gain);
      gain.connect(master);
      osc.start(start + tone.t);
      osc.stop(start + tone.t + (mode === 'handoff' ? 0.38 : 0.28));
    });
    aiManagerLastSoundAt = now;
  } catch {}
}

function notifyAiManagerEvent(chat, options = {}) {
  if (!chat || !['suggest', 'handoff'].includes(chat.mode)) return;
  const key = `${chat.id}:${chat.mode}`;
  if (!options.force && aiManagerNotifiedEvents.has(key)) return;
  aiManagerNotifiedEvents.add(key);
  playAiManagerSound(chat.mode, options);
}

function selectAiManagerChat(chatId) {
  const chat = aiManagerChats.find((item) => item.id === chatId);
  if (!chat) return;
  aiManagerActiveChatId = chat.id;
  renderAiManager();
}

function toggleAiManagerPower() {
  aiManagerEnabled = !aiManagerEnabled;
  renderAiManager();
}

function setAiManagerFilter(filter) {
  aiManagerFilter = ['all', 'handoff', 'suggest', 'auto'].includes(filter) ? filter : 'all';
  renderAiManager();
}

function getFilteredAiManagerChats() {
  const query = String(getEl('aiManagerSearch')?.value || '').trim().toLocaleLowerCase('ru-RU');
  return aiManagerChats.filter((chat) => {
    const matchesFilter = aiManagerFilter === 'all' || chat.mode === aiManagerFilter;
    if (!matchesFilter) return false;
    if (!query) return true;
    const haystack = `${chat.name} ${chat.phone} ${normalizePhoneKey(chat.phone)}`.toLocaleLowerCase('ru-RU');
    return haystack.includes(query);
  });
}

function checkAiManagerNotifications() {
  if (!aiManagerEnabled) {
    showToast('ИИ выключен. Включите его, чтобы проверять уведомления.', 'warn');
    renderAiManager();
    return;
  }
  const important = aiManagerChats.filter((chat) => ['handoff', 'suggest'].includes(chat.mode));
  aiManagerChats.forEach((chat) => { chat.highlight = important.includes(chat); });
  const first = important.find((chat) => chat.mode === 'handoff') || important[0];
  if (first) {
    aiManagerActiveChatId = first.id;
    if (aiManagerFilter !== 'all' && aiManagerFilter !== first.mode) aiManagerFilter = 'all';
    renderAiManager();
    requestAnimationFrame(() => {
      document.querySelector(`[data-ai-chat-id="${first.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    notifyAiManagerEvent(first, { force: true });
  } else {
    renderAiManager();
    showToast('Важных уведомлений нет', 'ok');
  }
}

function renderAiManagerChatList(activeChat) {
  const list = getEl('aiManagerChatList');
  if (!list) return;
  const filteredChats = getFilteredAiManagerChats();
  list.innerHTML = filteredChats.length ? filteredChats.map((chat) => {
    const meta = getAiManagerModeMeta(chat.mode);
    const isActive = chat.id === activeChat.id;
    return `
      <button class="ai-chat-item${isActive ? ' is-active' : ''}${chat.highlight ? ' is-alert' : ''}" type="button" data-ai-chat-id="${escHtml(chat.id)}" onclick="selectAiManagerChat('${escHtml(chat.id)}')">
        <div class="ai-chat-item-main">
          <div class="ai-chat-name">${escHtml(chat.name)}</div>
          <div class="ai-chat-phone">${escHtml(chat.phone)}</div>
          <div class="ai-chat-last">${escHtml(chat.lastMessage)}</div>
        </div>
        <span class="ai-status-pill ai-status-sm" data-mode="${meta.short}">${meta.short}</span>
      </button>`;
  }).join('') : '<div class="empty-mini">Чаты не найдены.</div>';
  document.querySelectorAll('[data-ai-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.aiFilter === aiManagerFilter);
  });
}

function renderAiManagerMessages(chat) {
  const stream = getEl('aiManagerMessages');
  if (!stream) return;
  stream.innerHTML = chat.messages.map((message) => {
    const isAi = message.from === 'ai';
    return `
      <div class="ai-message ${isAi ? 'ai-message-ai' : 'ai-message-client'}">
        <div class="ai-message-author">${isAi ? 'ИИ' : 'Клиент'}</div>
        <div class="ai-message-text">${escHtml(message.text)}</div>
      </div>`;
  }).join('');
}

function renderAiManagerControl(chat) {
  const control = getEl('aiManagerControl');
  if (!control) return;
  const meta = getAiManagerModeMeta(chat.mode);
  if (chat.mode === 'suggest') {
    control.innerHTML = `
      <div class="ai-control-kicker">${meta.title}</div>
      <textarea class="ai-suggest-input" rows="4">${escHtml(chat.aiReply || AI_MANAGER_REPLY)}</textarea>
      <div class="btn-row">
        <button class="btn btn-primary" type="button">Отправить</button>
        <button class="btn btn-secondary" type="button">Изменить</button>
        <button class="btn btn-ghost" type="button">Отклонить</button>
      </div>`;
    return;
  }
  if (chat.mode === 'handoff') {
    control.innerHTML = `
      <div class="ai-control-kicker">${meta.title}</div>
      <div class="ai-control-note">ИИ просит ответить вручную</div>
      <div class="ai-client-question">${escHtml(chat.lastMessage)}</div>
      <textarea class="ai-suggest-input" rows="4" placeholder="Введите ответ клиенту"></textarea>`;
    return;
  }
  control.innerHTML = `
    <div class="ai-control-kicker">${meta.title}</div>
    <div class="ai-control-note">ИИ ответил автоматически</div>
    <div class="ai-auto-answer">${escHtml(chat.aiReply || AI_MANAGER_REPLY)}</div>`;
}

function renderAiManagerClientCard(chat) {
  setText('aiManagerClientAvatar', (chat.name || 'К').trim().charAt(0).toUpperCase());
  setText('aiManagerClientName', chat.name);
  setText('aiManagerClientPhone', chat.phone);
  setText('aiManagerClientSize', chat.size);
  setText('aiManagerClientPurchases', chat.purchases);
}

function renderAiManager() {
  const chat = getAiManagerActiveChat();
  if (!chat) return;
  const meta = getAiManagerModeMeta(chat.mode);
  setText('aiManagerDialogName', chat.name);
  setText('aiManagerDialogPhone', chat.phone);
  const status = getEl('aiManagerDialogStatus');
  if (status) {
    status.textContent = meta.label;
    status.dataset.mode = meta.short;
  }
  renderAiManagerChatList(chat);
  renderAiManagerMessages(chat);
  renderAiManagerControl(chat);
  renderAiManagerClientCard(chat);
  const powerButton = getEl('aiManagerPowerBtn');
  const powerText = getEl('aiManagerPowerText');
  if (powerButton) {
    powerButton.classList.toggle('is-on', aiManagerEnabled);
    powerButton.classList.toggle('is-off', !aiManagerEnabled);
  }
  if (powerText) powerText.textContent = aiManagerEnabled ? 'ИИ включён' : 'ИИ выключен';
  const shell = document.querySelector('.ai-manager-shell');
  if (shell) shell.classList.toggle('ai-is-off', !aiManagerEnabled);
}

const RU_FORMS = {
  variant: ['вариант', 'варианта', 'вариантов'],
  contact: ['контакт', 'контакта', 'контактов'],
  message: ['сообщение', 'сообщения', 'сообщений'],
  base: ['база', 'базы', 'баз'],
  recipient: ['получатель', 'получателя', 'получателей'],
  error: ['ошибка', 'ошибки', 'ошибок'],
};

function pluralizeRu(count, forms) {
  const value = Math.abs(Number(count) || 0);
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function formatCountRu(count, forms) {
  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${safeCount} ${pluralizeRu(safeCount, forms)}`;
}

function getFolderVariantCount(folder) {
  return (folder?.variants || []).filter((message) => message && message.trim()).length;
}

function getFolderImageText(folder) {
  return folder?.image?.path ? 'изображение прикреплено' : 'без изображения';
}

function formatMessageFolderLine(folder) {
  if (!folder) return 'Папка сообщений не выбрана.';
  return `Папка «${folder.name}» — ${formatCountRu(getFolderVariantCount(folder), RU_FORMS.variant)}, ${getFolderImageText(folder)}.`;
}

function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
}

function getNumericInputValue(id, fallback = 0) {
  const value = parseInt(getEl(id)?.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function persistUiSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[LightFoot] Failed to persist UI setting', key, error);
  }
}

function setCollectState(label, tone = 'neutral') {
  setBadge(['collectStateBadge', 'collectStateBadgeMirror'], label, tone);
}

function setSendState(label, tone = 'neutral') {
  setBadge(['sendStateBadge', 'sendStateBadgePanel', 'sendStateBadgeInfo'], label, tone);
}

function setConnectState(label, tone = 'neutral') {
  setBadge('connectStateBadge', label, tone);
}

function normalizeWhatsAppStatus(status) {
  if (typeof status === 'string') {
    if (['connected', 'qr', 'loading', 'error', 'offline'].includes(status)) return status;
    return 'loading';
  }

  if (status?.connected) return 'connected';
  return 'loading';
}

function resetOpenWhatsAppButton(state = 'idle') {
  const btn = getEl('btnOpenWA');
  if (!btn || isOpeningWhatsApp) return;

  if (state === 'success') {
    btn.disabled = false;
    btn.dataset.state = 'success';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Подключён`;
    return;
  }

  btn.disabled = false;
  btn.dataset.state = 'idle';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Подключить`;
}

function applyWhatsAppStatus(status) {
  const nextStatus = normalizeWhatsAppStatus(status);
  const badge = getEl('connectionBadge');
  const text = getEl('connectionText');

  if (badge) {
    badge.classList.toggle('connected', nextStatus === 'connected');
  }

  if (!text) return;

  if (nextStatus === 'offline') {
    setConnectStatus('WhatsApp не подключён.', '');
    setConnectState('Не подключён', 'neutral');
    text.textContent = 'Не подключён';
    resetOpenWhatsAppButton();
    return;
  }

  if (nextStatus === 'connected') {
    setConnectStatus('WhatsApp подключён.', 'ok');
    setConnectState('Подключено', 'success');
    text.textContent = 'Подключено';
    resetOpenWhatsAppButton('success');
    return;
  }

  resetOpenWhatsAppButton();

  if (nextStatus === 'qr') {
    setConnectStatus('Требуется вход в WhatsApp.', 'err');
    setConnectState('Требуется вход', 'error');
    text.textContent = 'Требуется вход';
    return;
  }

  if (nextStatus === 'error') {
    setConnectStatus('Не удалось проверить статус WhatsApp.', 'err');
    setConnectState('Ошибка', 'error');
    text.textContent = 'Ошибка';
    return;
  }

  setConnectStatus('Проверяем WhatsApp...', 'warn');
  setConnectState('Загрузка', 'warning');
  text.textContent = 'Загрузка';
}

function startWhatsAppStatusPolling() {
  if (waStatusPollTimer) return;
  waStatusPollTimer = setInterval(() => {
    void checkStatus(currentActiveAccountId);
  }, WA_STATUS_POLL_MS);
}

function updateCollectProgress(found = contacts.length, target = getNumericInputValue('collectTargetCount', contacts.length || 0)) {
  const safeTarget = Math.max(target || 0, 0);
  setText('collectProgressText', safeTarget > 0 ? `${Math.min(found, safeTarget)} / ${safeTarget}` : `${found}`);

  const bar = getEl('collectProgressBar');
  if (!bar) return;
  if (safeTarget <= 0) {
    bar.style.width = '0%';
    return;
  }
  bar.style.width = `${Math.min((found / safeTarget) * 100, 100)}%`;
}

function resetCollectSession(target = getNumericInputValue('collectTargetCount', 0), mode = 'continue') {
  collectSessionCurrent = 0;
  collectSessionTarget = Math.max(Number(target) || 0, 0);
  activeCollectMode = mode;
  updateCollectProgress(collectSessionCurrent, collectSessionTarget);
}

function updateSendProgressSummary({
  sent = 0,
  errors = 0,
  remaining = 0,
  total = totalToSend,
} = {}) {
  const resolvedTotal = total || sent + errors + remaining;
  const processed = sent + errors;
  setText('sendProgressText', resolvedTotal > 0 ? `${processed} из ${resolvedTotal}` : '0 из 0');
}

function updateDashboardSummary() {
  setText('dashboardContactsValue', String(contacts.length));
  setText('dashboardMessagesValue', String(messages.filter((message) => message && message.trim()).length));
  const dashboardBaseValue = currentSendBase
    ? `${getBaseLabel(currentSendBase)} • ${formatCountRu(getBaseCount(currentSendBase), RU_FORMS.contact)}`
    : 'База не выбрана';
  setText('dashboardSendBaseValue', dashboardBaseValue);
  const dashboardBaseEl = getEl('dashboardSendBaseValue');
  if (dashboardBaseEl) dashboardBaseEl.title = dashboardBaseValue;

  const folder = getActiveMessageFolder();
  const imageLabel = folder ? formatMessageFolderLine(folder) : 'Папка сообщений не выбрана.';
  setText('dashboardImageValue', imageLabel);
  const dashboardImageEl = getEl('dashboardImageValue');
  if (dashboardImageEl) dashboardImageEl.title = imageLabel;
}

function applyStoredInputValue(id, storageKey) {
  const el = getEl(id);
  const value = localStorage.getItem(storageKey);
  if (el && value !== null && value !== '') {
    el.value = value;
  }
}

function loadUiSettings() {
  applyStoredInputValue('collectTargetCount', STORAGE_KEYS.collectTarget);
  applyStoredInputValue('sendCount', STORAGE_KEYS.sendCount);
  applyStoredInputValue('sendRepeatMode', STORAGE_KEYS.sendRepeatMode);
  applyStoredInputValue('delayMin', STORAGE_KEYS.delayMin);
  applyStoredInputValue('delayMax', STORAGE_KEYS.delayMax);
  applyStoredInputValue('skipDays', STORAGE_KEYS.skipDays);

  const safeMode = getEl('safeMode');
  const storedSafeMode = localStorage.getItem(STORAGE_KEYS.safeMode);
  if (safeMode && storedSafeMode !== null) {
    safeMode.checked = storedSafeMode === '1';
  }
}

function bindUiPersistence() {
  const bindings = [
    ['collectTargetCount', 'input', STORAGE_KEYS.collectTarget],
    ['sendCount', 'change', STORAGE_KEYS.sendCount],
    ['sendRepeatMode', 'change', STORAGE_KEYS.sendRepeatMode],
    ['delayMin', 'input', STORAGE_KEYS.delayMin],
    ['delayMax', 'input', STORAGE_KEYS.delayMax],
    ['skipDays', 'input', STORAGE_KEYS.skipDays],
  ];

  bindings.forEach(([id, eventName, storageKey]) => {
    const el = getEl(id);
    if (!el || el.dataset.persistBound) return;
    el.dataset.persistBound = '1';
    el.addEventListener(eventName, () => {
      persistUiSetting(storageKey, el.value);
      if (id === 'collectTargetCount') {
        collectSessionTarget = getNumericInputValue('collectTargetCount', 0);
        updateCollectPresetState();
        updateCollectProgress(collectSessionCurrent, collectSessionTarget);
      }
      if (id === 'sendRepeatMode') updateSendRepeatModeUi();
    });
  });

  const safeMode = getEl('safeMode');
  if (safeMode && !safeMode.dataset.persistBound) {
    safeMode.dataset.persistBound = '1';
    safeMode.addEventListener('change', () => {
      persistUiSetting(STORAGE_KEYS.safeMode, safeMode.checked ? '1' : '0');
    });
  }
}

function updateSendRepeatModeUi() {
  const mode = getEl('sendRepeatMode')?.value || 'skip-ever';
  const skipDaysGroup = getEl('skipDaysGroup');
  const skipDaysInput = getEl('skipDays');
  if (skipDaysGroup) skipDaysGroup.style.display = mode === 'skip-days' ? '' : 'none';
  if (skipDaysInput) {
    if (mode === 'skip-days' && (!Number(skipDaysInput.value) || Number(skipDaysInput.value) < 1)) {
      skipDaysInput.value = '30';
      persistUiSetting(STORAGE_KEYS.skipDays, '30');
    }
    skipDaysInput.disabled = isSending || mode !== 'skip-days';
  }
}

function updateCollectPresetState() {
  const targetValue = String(getNumericInputValue('collectTargetCount', 0));
  document.querySelectorAll('[data-collect-preset]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.collectPreset === targetValue);
  });
}

function bindCollectPresets() {
  document.querySelectorAll('[data-collect-preset]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const value = button.dataset.collectPreset || '50';
      const input = getEl('collectTargetCount');
      if (input) input.value = value;
      persistUiSetting(STORAGE_KEYS.collectTarget, value);
      collectSessionTarget = parseInt(value, 10) || 0;
      updateCollectPresetState();
      updateCollectProgress(collectSessionCurrent, collectSessionTarget);
    });
  });
}

function clearLog() {
  const log = getEl('logArea');
  if (!log) return;
  log.innerHTML = `<div class="log-line info">${DEFAULT_LOG_PLACEHOLDER}</div>`;
  showToast('Лог очищен', 'warn');
}

function normalizeError(error) {
  if (!error) return 'Неизвестная ошибка';
  if (typeof error === 'string') return error;
  return error.message || String(error);
}

function reportError(context, error, opts = {}) {
  const {
    statusId = '',
    statusType = 'err',
    toast = true,
    log = true,
  } = opts;

  const message = normalizeError(error);
  console.error(`[LightFoot] ${context}`, error);

  if (statusId) {
    setStatus(statusId, `${context}: ${message}`, statusType);
  }

  if (log) {
    addLog(`${context}: ${message}`, 'err');
  }

  if (toast) {
    showToast(`${context}: ${message}`, 'err');
  }

  return message;
}

function replaceContacts(nextContacts) {
  contacts = Array.isArray(nextContacts) ? nextContacts.filter(Boolean) : [];
  contactPhoneSet = new Set(contacts.map(contact => normalizePhoneKey(contact?.normalizedPhone || contact?.phone)).filter(Boolean));
  rebuildContactSearchIndex();
  contactFilterCacheKey = '';
}

function appendContactIfNew(contact) {
  const phone = contact?.phone;
  const phoneKey = normalizePhoneKey(contact?.normalizedPhone || phone);
  if (!phone || !phoneKey || contactPhoneSet.has(phoneKey)) return false;
  const normalizedContact = {
    ...contact,
    phone: String(contact.phone || '').trim(),
    normalizedPhone: phoneKey,
    name: String(contact.name || contact.phone || '').trim() || String(contact.phone || '').trim(),
    source: String(contact.source || 'chat'),
  };
  contactPhoneSet.add(phoneKey);
  contacts.push(normalizedContact);
  contactSearchIndex.push(buildContactSearchEntry(normalizedContact));
  contactFilterCacheKey = '';
  appendContactToList();
  syncBaseCount(currentContactsBase, contacts.length);
  return true;
}

function syncContactPhoneSet() {
  contactPhoneSet = new Set(contacts.map(contact => normalizePhoneKey(contact?.normalizedPhone || contact?.phone)).filter(Boolean));
  rebuildContactSearchIndex();
}

function buildContactSearchEntry(contact) {
  const name = String(contact?.name || '');
  const phone = String(contact?.phone || '');
  const normalizedPhone = String(normalizePhoneKey(contact?.normalizedPhone || phone) || '');
  return {
    name,
    phone,
    normalizedPhone,
    nameLower: name.toLocaleLowerCase('ru-RU'),
    phoneLower: phone.toLocaleLowerCase('ru-RU'),
    phoneKey: normalizedPhone,
  };
}

function rebuildContactSearchIndex() {
  contactSearchIndex = contacts.map(buildContactSearchEntry);
  contactFilterCacheKey = '';
}

function getBaseById(baseId) {
  return bases.find((base) => base.id === baseId) || null;
}

function getFirstBaseId() {
  return bases[0]?.id || '';
}

function resolveBaseId(baseId, fallbackId = '') {
  if (baseId && getBaseById(baseId)) return baseId;
  if (fallbackId && getBaseById(fallbackId)) return fallbackId;
  return getFirstBaseId();
}

function getBaseLabel(type) {
  return getBaseById(type)?.name || BASE_LABELS[type] || 'Без базы';
}

function getBaseCount(baseId) {
  const base = getBaseById(baseId);
  if (!base) return 0;
  return base.id === currentContactsBase ? Math.max(base.count || 0, contacts.length) : (base.count || 0);
}

function renderBaseSelectOptions() {
  const optionsHtml = bases.length
    ? bases.map((base) => {
        const countLabel = formatCountRu(base.count || 0, RU_FORMS.contact);
        return `<option value="${escHtml(base.id)}" title="${escHtml(base.name)}">${escHtml(base.name)} (${countLabel})</option>`;
      }).join('')
    : '<option value="">Нет баз</option>';

  [
    ['contactBaseType', currentContactsBase],
    ['sendBaseType', currentSendBase],
  ].forEach(([id, selectedId]) => {
    const select = getEl(id);
    if (!select) return;

    const resolvedValue = resolveBaseId(selectedId, select.value);
    select.innerHTML = optionsHtml;
    select.value = resolvedValue || '';
    select.disabled = !bases.length
      || (id === 'contactBaseType' && isCollecting)
      || (id === 'sendBaseType' && isSending);
  });
}

function updateBaseSummaryCards() {
  [
    ['collectBaseSummaryCard', 'collectBaseSummaryValue', 'collectBaseSummaryMeta', currentContactsBase],
    ['sendBaseSummaryCard', 'sendBaseSummaryValue', 'sendBaseSummaryMeta', currentSendBase],
  ].forEach(([cardId, valueId, metaId, baseId]) => {
    const card = getEl(cardId);
    const valueEl = getEl(valueId);
    const metaEl = getEl(metaId);
    const base = getBaseById(baseId);

    if (card) {
      card.classList.toggle('is-active', !!base);
      card.classList.toggle('is-empty', !base);
    }

    if (valueEl) {
      valueEl.textContent = base ? base.name : 'База не выбрана';
      valueEl.title = base ? base.name : '';
    }
    if (metaEl) metaEl.textContent = base ? formatCountRu(getBaseCount(base.id), RU_FORMS.contact) : 'Создайте или выберите базу';
  });
}

function updateBaseActionButtons() {
  const hasBases = bases.length > 0;
  const hasMultipleBases = bases.length > 1;
  const lockEditing = isCollecting || isSending;

  ['btnCreateBase', 'btnCreateBaseSend'].forEach((id) => {
    const button = getEl(id);
    if (button) button.disabled = lockEditing;
  });

  ['btnRenameBase', 'btnRenameBaseSend'].forEach((id) => {
    const button = getEl(id);
    if (button) button.disabled = !hasBases || lockEditing;
  });

  ['btnDeleteBase', 'btnDeleteBaseSend'].forEach((id) => {
    const button = getEl(id);
    if (button) button.disabled = !hasMultipleBases || lockEditing;
  });
}

function renderAccountSelectOptions() {
  const select = getEl('sendAccountId');
  if (!select) return;

  const optionsHtml = accounts.length
    ? accounts
        .map((account) => `<option value="${escHtml(account.id)}">${escHtml(account.name)}</option>`)
        .join('')
    : '<option value="">Нет аккаунтов</option>';

  const resolvedValue = resolveAccountId(currentSendAccountId, currentActiveAccountId);
  currentSendAccountId = resolvedValue || '';
  select.innerHTML = optionsHtml;
  select.value = resolvedValue || '';
  select.disabled = !accounts.length || isSending;
}

function updateAccountSummary() {
  const activeAccount = getAccountById(currentActiveAccountId);
  const sendAccount = getAccountById(currentSendAccountId || currentActiveAccountId);
  const activeMeta = getAccountStatusMeta(activeAccount?.status || 'offline');

  setBadge('accountsStateBadge', activeAccount ? `Активный: ${activeAccount.name}` : 'Аккаунт не выбран', activeMeta.tone);
  setText('dashboardActiveAccount', activeAccount ? activeAccount.name : 'Аккаунт не выбран');
  setText(
    'dashboardAccountHint',
    activeAccount
      ? `${activeMeta.text}. ${sendAccount ? `Для рассылки выбран ${sendAccount.name}.` : 'Аккаунт готов к работе.'}`
      : 'Подключите WhatsApp и выберите, что делать дальше.'
  );

  const sendSummary = getEl('sendAccountSummary');
  if (sendSummary) {
    sendSummary.textContent = sendAccount
      ? `WhatsApp-аккаунт «${sendAccount.name}» — ${getAccountStatusMeta(sendAccount.status).text}.`
      : 'Выберите WhatsApp-аккаунт для отправки.';
  }
}

function renderAccountsPanel() {
  const list = getEl('waAccountsList');
  if (!list) return;

  if (!accounts.length) {
    list.innerHTML = '<div class="empty-state"><p>Аккаунты WhatsApp недоступны.</p></div>';
    updateAccountSummary();
    return;
  }

  list.innerHTML = accounts
    .map((account) => {
      const meta = getAccountStatusMeta(account.status);
      const isActive = account.id === currentActiveAccountId;
      const isBusy = isCollecting || isSending || isOpeningWhatsApp;

      return `
        <div class="account-card ${isActive ? 'is-active' : ''}" data-account-id="${escHtml(account.id)}">
          <div class="account-card-head">
            <div>
              <div class="account-card-title">${escHtml(account.name)}</div>
              <div class="account-card-subtitle">${escHtml(account.id)}${isActive ? ' • активный' : ''}</div>
            </div>
            <div class="status-chip" data-tone="${meta.tone}">${meta.label}</div>
          </div>
          <div class="account-status-line">
            <span class="account-status-dot" data-tone="${meta.tone}"></span>
            <span>${meta.text}</span>
          </div>
          <div class="account-card-actions">
            <button class="btn btn-primary btn-sm" data-account-action="open" data-account-id="${escHtml(account.id)}" ${isBusy ? 'disabled' : ''}>Подключить</button>
            <button class="btn btn-secondary btn-sm" data-account-action="active" data-account-id="${escHtml(account.id)}" ${(isBusy || isActive) ? 'disabled' : ''}>Сделать активным</button>
            <button class="btn btn-ghost btn-sm" data-account-action="status" data-account-id="${escHtml(account.id)}" ${isOpeningWhatsApp ? 'disabled' : ''}>Проверить статус</button>
            <button class="btn btn-ghost btn-sm" data-account-action="rename" data-account-id="${escHtml(account.id)}" ${isBusy ? 'disabled' : ''}>Переименовать</button>
            <button class="btn btn-danger btn-sm" data-account-action="disconnect" data-account-id="${escHtml(account.id)}" ${isBusy ? 'disabled' : ''}>Отключить</button>
          </div>
        </div>`;
    })
    .join('');

  updateAccountSummary();
}

async function refreshAccounts({ preferredActiveAccount = '', preferredSendAccount = '', silent = false } = {}) {
  try {
    const loadedAccounts = await window.api.accountsList();
    accounts = Array.isArray(loadedAccounts) ? loadedAccounts.filter(Boolean) : [];

    currentActiveAccountId = resolveAccountId(
      preferredActiveAccount || currentActiveAccountId || localStorage.getItem(STORAGE_KEYS.activeAccount)
    );
    currentSendAccountId = resolveAccountId(
      preferredSendAccount || currentSendAccountId || localStorage.getItem(STORAGE_KEYS.sendAccount),
      currentActiveAccountId
    );

    if (currentActiveAccountId) persistUiSetting(STORAGE_KEYS.activeAccount, currentActiveAccountId);
    if (currentSendAccountId) persistUiSetting(STORAGE_KEYS.sendAccount, currentSendAccountId);

    renderAccountSelectOptions();
    renderAccountsPanel();
    updateAccountSummary();
    return accounts.length > 0;
  } catch (error) {
    accounts = [];
    currentActiveAccountId = '';
    currentSendAccountId = '';
    renderAccountSelectOptions();
    renderAccountsPanel();
    if (!silent) {
      reportError('Не удалось загрузить аккаунты WhatsApp', error, { statusId: 'connectStatus' });
    }
    return false;
  }
}

async function setActiveAccountUi(accountId, { silent = false } = {}) {
  const resolvedAccountId = resolveAccountId(accountId, currentActiveAccountId);
  if (!resolvedAccountId) return false;

  const result = await window.api.accountSetActive(resolvedAccountId);
  if (!result?.ok) {
    if (!silent) throw new Error(result?.error || 'Не удалось выбрать активный аккаунт');
    return false;
  }

  currentActiveAccountId = resolvedAccountId;
  if (!currentSendAccountId) currentSendAccountId = resolvedAccountId;
  await refreshAccounts({
    preferredActiveAccount: currentActiveAccountId,
    preferredSendAccount: currentSendAccountId,
    silent: true,
  });
  applyWhatsAppStatus(getAccountById(currentActiveAccountId)?.status || 'offline');
  return true;
}

async function renameAccountUi(accountId) {
  if (isCollecting || isSending || isOpeningWhatsApp) return;
  const account = getAccountById(accountId);
  if (!account) return;

  const nextName = await requestBaseName('Введите новое название аккаунта', account.name, {
    placeholder: 'Название аккаунта',
    existingItems: accounts,
    currentId: account.id,
    emptyMessage: 'Введите название аккаунта',
    duplicateMessage: 'Аккаунт с таким названием уже есть',
  });
  if (!nextName) return;

  try {
    const result = await window.api.accountRename({ id: accountId, name: nextName });
    if (!result?.ok) throw new Error(result?.error || 'Не удалось переименовать аккаунт');
    await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId || accountId,
      preferredSendAccount: currentSendAccountId || accountId,
      silent: true,
    });
    showToast(`Аккаунт «${nextName}» сохранён`, 'ok');
  } catch (error) {
    reportError('Не удалось переименовать аккаунт', error, { statusId: 'connectStatus' });
  }
}

async function disconnectAccountUi(accountId) {
  if (isCollecting || isSending || isOpeningWhatsApp) return;

  try {
    const result = await window.api.accountDisconnect(accountId);
    if (!result?.ok) throw new Error(result?.error || 'Не удалось отключить аккаунт');
    await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId,
      preferredSendAccount: currentSendAccountId,
      silent: true,
    });
    if (accountId === currentActiveAccountId) {
      applyWhatsAppStatus('offline');
    }
    showToast(`Аккаунт ${getAccountLabel(accountId)} отключён`, 'warn');
  } catch (error) {
    reportError('Не удалось отключить аккаунт', error, { statusId: 'connectStatus' });
  }
}

async function handleAccountAction(action, accountId) {
  const resolvedAccountId = resolveAccountId(accountId, currentActiveAccountId);
  if (!resolvedAccountId) return;

  switch (action) {
    case 'open':
      await openWhatsApp(resolvedAccountId);
      break;
    case 'active':
      await setActiveAccountUi(resolvedAccountId);
      setConnectStatus(`Активный аккаунт: ${getAccountLabel(resolvedAccountId)}`, 'ok');
      void checkStatus(resolvedAccountId);
      break;
    case 'status':
      void checkStatus(resolvedAccountId);
      break;
    case 'rename':
      await renameAccountUi(resolvedAccountId);
      break;
    case 'disconnect':
      await disconnectAccountUi(resolvedAccountId);
      break;
    default:
      break;
  }
}

function syncBaseSelections() {
  const collectSelect = getEl('contactBaseType');
  if (collectSelect && currentContactsBase) collectSelect.value = currentContactsBase;

  const sendSelect = getEl('sendBaseType');
  if (sendSelect && currentSendBase) sendSelect.value = currentSendBase;
}

function syncBaseCount(baseId, count) {
  const base = getBaseById(baseId);
  if (!base) return;
  base.count = Math.max(0, Number(count) || 0);
  updateBaseSummaryCards();
  updateDashboardSummary();
}

async function refreshBaseCatalog({ preferredCollectBase = '', preferredSendBase = '', silent = false } = {}) {
  try {
    const loadedBases = await window.api.basesList();
    bases = Array.isArray(loadedBases) ? loadedBases.filter(Boolean) : [];

    currentContactsBase = resolveBaseId(
      preferredCollectBase || currentContactsBase || localStorage.getItem(STORAGE_KEYS.contactsBase),
      preferredSendBase || currentSendBase
    );
    currentSendBase = resolveBaseId(
      preferredSendBase || currentSendBase || localStorage.getItem(STORAGE_KEYS.sendBase),
      currentContactsBase
    );

    if (currentContactsBase) persistUiSetting(STORAGE_KEYS.contactsBase, currentContactsBase);
    if (currentSendBase) persistUiSetting(STORAGE_KEYS.sendBase, currentSendBase);

    renderBaseSelectOptions();
    syncBaseSelections();
    updateBaseSummaryCards();
    updateBaseActionButtons();
    renderAccountsPanel();
    renderAccountSelectOptions();
    updateAccountSummary();
    updateDashboardSummary();

    return bases.length > 0;
  } catch (error) {
    bases = [];
    currentContactsBase = '';
    currentSendBase = '';
    renderBaseSelectOptions();
    updateBaseSummaryCards();
    updateBaseActionButtons();

    if (!silent) {
      reportError('Не удалось загрузить список баз', error, { statusId: 'collectStatus' });
    }

    return false;
  }
}

function getContactsBaseType() {
  return document.getElementById('contactBaseType')?.value || currentContactsBase || getFirstBaseId();
}

function getSendBaseType() {
  return document.getElementById('sendBaseType')?.value || currentSendBase || getFirstBaseId();
}

async function loadContactsBase(type, { silent = false } = {}) {
  try {
    return await loadContactsBaseNew(type, { silent });
    currentContactsBase = type || 'main';
    localStorage.setItem(STORAGE_KEYS.contactsBase, currentContactsBase);

    const collectSelect = getEl('contactBaseType');
    if (collectSelect && collectSelect.value !== currentContactsBase) collectSelect.value = currentContactsBase;

    const loadInfo = window.api.contactsLoadInfo
      ? await window.api.contactsLoadInfo(currentContactsBase)
      : { ok: true, contacts: await window.api.contactsLoad(currentContactsBase) || [], total: 0, removedDuplicates: 0, final: 0 };
    replaceContacts(loadInfo?.contacts || []);
    testSelectedContacts = testSelectedContacts.filter((item) => contactPhoneSet.has(normalizePhoneKey(item?.phone)));
    renderContactList();
    baseUnsaved = false;
    updateCollectProgress(contacts.length);
    updateCollectPresetState();
    updateDashboardSummary();

    if (!silent) {
      const total = Number(loadInfo?.total ?? contacts.length);
      const removed = Number(loadInfo?.removedDuplicates || 0);
      const finalCount = Number(loadInfo?.final ?? contacts.length);
      setStatus('collectStatus', `Загружена база: ${getBaseLabel(currentContactsBase)}. Всего: ${total}, удалено дублей: ${removed}, итог: ${finalCount}.`, removed > 0 ? 'warn' : 'ok');
    }
  } catch (error) {
    replaceContacts([]);
    renderContactList();
    reportError('Не удалось загрузить базу контактов', error, {
      statusId: silent ? '' : 'collectStatus',
      toast: !silent,
    });
  }
}

async function getContactsForSending() {
  try {
    return await getContactsForSendingNew();
    currentSendBase = getSendBaseType();
    localStorage.setItem(STORAGE_KEYS.sendBase, currentSendBase);
    updateDashboardSummary();
    return await window.api.contactsLoad(currentSendBase) || [];
  } catch (error) {
    reportError('Не удалось загрузить базу для рассылки', error, { statusId: 'sendStatus' });
    return [];
  }
}

async function persistCurrentContacts() {
  try {
    return await persistCurrentContactsNew();
    await window.api.contactsSave(contacts, currentContactsBase);
    return true;
  } catch (error) {
    reportError('Не удалось сохранить базу контактов', error, {
      statusId: 'collectStatus',
      toast: false,
    });
    return false;
  }
}

// ─── Init ────────────────────────────────────────────────────────
async function loadContactsBaseNew(type, { silent = false, refreshCatalog = true } = {}) {
  try {
    if (refreshCatalog) {
      const hasBases = await refreshBaseCatalog({ preferredCollectBase: type || currentContactsBase, silent });
      if (!hasBases) {
        replaceContacts([]);
        renderContactList();
        setCollectState('Нет базы', 'warning');
        if (!silent) setStatus('collectStatus', 'Создайте базу перед сбором контактов.', 'warn');
        return;
      }
    }

    currentContactsBase = resolveBaseId(type || currentContactsBase, currentSendBase);
    persistUiSetting(STORAGE_KEYS.contactsBase, currentContactsBase);

    const collectSelect = getEl('contactBaseType');
    if (collectSelect && collectSelect.value !== currentContactsBase) collectSelect.value = currentContactsBase;

    const loadInfo = window.api.contactsLoadInfo
      ? await window.api.contactsLoadInfo(currentContactsBase)
      : { ok: true, contacts: await window.api.contactsLoad(currentContactsBase) || [] };
    if (!loadInfo?.ok) throw new Error(loadInfo?.error || 'Не удалось загрузить базу');

    replaceContacts(loadInfo.contacts || []);
    testSelectedContacts = testSelectedContacts.filter((item) => contactPhoneSet.has(normalizePhoneKey(item?.phone)));
    renderContactList({ resetScroll: true });
    baseUnsaved = false;
    resetCollectSession(getNumericInputValue('collectTargetCount', 0), 'continue');
    updateCollectPresetState();
    syncBaseCount(currentContactsBase, contacts.length);
    syncBaseSelections();
    updateDashboardSummary();

    if (!silent) {
      const total = Number(loadInfo.total ?? loadInfo.totalBefore ?? contacts.length);
      const removed = Number(loadInfo.removedDuplicates || 0);
      const finalCount = Number(loadInfo.final ?? loadInfo.totalAfter ?? contacts.length);
      const migratedText = loadInfo.migrated ? ' База обновлена и очищена от дублей.' : '';
      setStatus(
        'collectStatus',
        `Загружена база: ${getBaseLabel(currentContactsBase)}. Всего: ${total}, удалено дублей: ${removed}, итог: ${finalCount}.${migratedText}`,
        removed > 0 || loadInfo.migrated ? 'warn' : 'ok'
      );
      if (loadInfo.migrated) showToast('База обновлена и очищена от дублей.', 'warn');
    }
  } catch (error) {
    replaceContacts([]);
    renderContactList();
    reportError('Не удалось загрузить базу контактов', error, {
      statusId: silent ? '' : 'collectStatus',
      toast: !silent,
    });
  }
}

async function getContactsForSendingNew() {
  try {
    const hasBases = await refreshBaseCatalog({
      preferredCollectBase: currentContactsBase,
      preferredSendBase: getSendBaseType() || currentSendBase,
      silent: true,
    });

    if (!hasBases) {
      const message = 'Нет доступных баз. Создайте базу перед рассылкой.';
      setStatus('sendStatus', message, 'err');
      showToast(message, 'err');
      return [];
    }

    currentSendBase = resolveBaseId(getSendBaseType() || currentSendBase, currentContactsBase);
    persistUiSetting(STORAGE_KEYS.sendBase, currentSendBase);
    syncBaseSelections();
    updateBaseSummaryCards();
    updateDashboardSummary();
    lastSendLoadInfo = window.api.contactsLoadInfo
      ? await window.api.contactsLoadInfo(currentSendBase)
      : { ok: true, contacts: await window.api.contactsLoad(currentSendBase) || [] };
    if (!lastSendLoadInfo?.ok) throw new Error(lastSendLoadInfo?.error || 'Не удалось загрузить базу');
    return lastSendLoadInfo.contacts || [];
  } catch (error) {
    lastSendLoadInfo = null;
    reportError('Не удалось загрузить базу для рассылки', error, { statusId: 'sendStatus' });
    return [];
  }
}

async function persistCurrentContactsNew({ silent = false, refreshCatalog = true } = {}) {
  try {
    if (!currentContactsBase) {
      if (!silent) setStatus('collectStatus', 'Нет выбранной базы для сохранения.', 'err');
      return false;
    }

    await window.api.contactsSave(contacts, currentContactsBase);
    syncBaseCount(currentContactsBase, contacts.length);

    if (refreshCatalog) {
      await refreshBaseCatalog({
        preferredCollectBase: currentContactsBase,
        preferredSendBase: currentSendBase,
        silent: true,
      });
    }

    return true;
  } catch (error) {
    reportError('Не удалось сохранить базу контактов', error, {
      statusId: 'collectStatus',
      toast: false,
    });
    return false;
  }
}

function getBaseTargetId(target = 'contacts') {
  return target === 'send'
    ? resolveBaseId(getSendBaseType() || currentSendBase, currentContactsBase)
    : resolveBaseId(getContactsBaseType() || currentContactsBase, currentSendBase);
}

function getBaseStatusId(target = 'contacts') {
  return target === 'send' ? 'sendStatus' : 'collectStatus';
}

function requestBaseName(title, initialValue = '', options = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    let settled = false;

    const finish = (value = '') => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(typeof value === 'string' ? value.trim() : '');
    };

    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${escHtml(title)}</div>
        <div class="modal-body">
          <input type="text" id="baseNameInput" value="${escHtml(initialValue)}" placeholder="${escHtml(options.placeholder || 'Название')}" maxlength="${Number(options.maxLength || 80)}" autofocus>
          <div class="field-error" id="baseNameError"></div>
        </div>
        <div class="modal-btns">
          <button class="btn btn-primary btn-sm" id="baseNameConfirm">Сохранить</button>
          <button class="btn btn-ghost btn-sm" id="baseNameCancel">Отмена</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#baseNameInput');
    const errorEl = overlay.querySelector('#baseNameError');
    const confirmBtn = overlay.querySelector('#baseNameConfirm');
    const cancelBtn = overlay.querySelector('#baseNameCancel');
    const showError = (message) => {
      if (input) input.classList.add('is-invalid');
      if (errorEl) errorEl.textContent = message;
    };
    const clearError = () => {
      if (input) input.classList.remove('is-invalid');
      if (errorEl) errorEl.textContent = '';
    };
    const submit = () => {
      const validation = validateNameInput(input?.value || '', options.existingItems || [], {
        currentId: options.currentId,
        emptyMessage: options.emptyMessage || 'Введите название',
        duplicateMessage: options.duplicateMessage || 'Название уже используется',
      });
      if (!validation.ok) {
        showError(validation.error);
        return;
      }
      finish(validation.name);
    };

    if (input) {
      input.focus();
      input.select();
      input.addEventListener('input', clearError);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          finish('');
        }
      });
    }

    if (confirmBtn) confirmBtn.addEventListener('click', submit);
    if (cancelBtn) cancelBtn.addEventListener('click', () => finish(''));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish('');
    });
  });
}

function showConfirmDialog({
  title = 'Подтверждение',
  body = '',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  tone = 'danger',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(Boolean(value));
    };

    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${escHtml(title)}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-btns">
          <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'} btn-sm" id="confirmYes">${escHtml(confirmText)}</button>
          <button class="btn btn-ghost btn-sm" id="confirmNo">${escHtml(cancelText)}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#confirmYes')?.addEventListener('click', () => finish(true));
    overlay.querySelector('#confirmNo')?.addEventListener('click', () => finish(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
    });
  });
}

async function createBase(target = 'contacts') {
  if (isCollecting || isSending) return;

  const name = await requestBaseName('Введите название новой базы', '', {
    placeholder: 'Название базы',
    existingItems: bases,
    emptyMessage: 'Введите название базы',
    duplicateMessage: 'База с таким названием уже есть',
  });
  if (!name) return;

  try {
    const result = await window.api.baseCreate(name);
    if (!result?.ok || !result.base?.id) {
      throw new Error(result?.error || 'Не удалось создать базу');
    }

    const nextBaseId = result.base.id;
    await refreshBaseCatalog({
      preferredCollectBase: target === 'contacts' ? nextBaseId : currentContactsBase,
      preferredSendBase: target === 'send' ? nextBaseId : currentSendBase,
      silent: true,
    });

    if (target === 'contacts') {
      await loadContactsBaseNew(nextBaseId, { silent: true, refreshCatalog: false });
      setStatus('collectStatus', `Создана база: ${getBaseLabel(nextBaseId)}`, 'ok');
    } else {
      currentSendBase = resolveBaseId(nextBaseId, currentContactsBase);
      persistUiSetting(STORAGE_KEYS.sendBase, currentSendBase);
      syncBaseSelections();
      updateBaseSummaryCards();
      updateDashboardSummary();
      setStatus('sendStatus', `Создана база: ${getBaseLabel(nextBaseId)}`, 'ok');
    }

    showToast(`База «${getBaseLabel(nextBaseId)}» создана`, 'ok');
  } catch (error) {
    reportError('Не удалось создать базу', error, { statusId: getBaseStatusId(target) });
  }
}

async function renameBase(target = 'contacts') {
  if (isCollecting || isSending) return;

  const baseId = getBaseTargetId(target);
  const base = getBaseById(baseId);
  if (!base) {
    showToast('База не выбрана', 'err');
    return;
  }

  const nextName = await requestBaseName('Введите новое название базы', base.name, {
    placeholder: 'Название базы',
    existingItems: bases,
    currentId: base.id,
    emptyMessage: 'Введите название базы',
    duplicateMessage: 'База с таким названием уже есть',
  });
  if (!nextName || nextName === base.name) return;

  try {
    const result = await window.api.baseRename({ id: baseId, name: nextName });
    if (!result?.ok) {
      throw new Error(result?.error || 'Не удалось переименовать базу');
    }

    await refreshBaseCatalog({
      preferredCollectBase: currentContactsBase === baseId ? baseId : currentContactsBase,
      preferredSendBase: currentSendBase === baseId ? baseId : currentSendBase,
      silent: true,
    });

    syncBaseCount(currentContactsBase, contacts.length);
    setStatus(getBaseStatusId(target), `База переименована: ${getBaseLabel(baseId)}`, 'ok');
    showToast(`База переименована в «${getBaseLabel(baseId)}»`, 'ok');
  } catch (error) {
    reportError('Не удалось переименовать базу', error, { statusId: getBaseStatusId(target) });
  }
}

async function deleteBase(target = 'contacts') {
  if (isCollecting || isSending) return;

  const baseId = getBaseTargetId(target);
  const base = getBaseById(baseId);
  if (!base) {
    showToast('База не выбрана', 'err');
    return;
  }

  const contactsCount = getBaseCount(baseId);
  const confirmed = await showConfirmDialog({
    title: 'Удалить базу?',
    body: `Удалить базу «${escHtml(base.name)}»? В ней ${formatCountRu(contactsCount, RU_FORMS.contact)}. Контакты этой базы будут удалены без восстановления.`,
    confirmText: 'Удалить',
    tone: 'danger',
  });
  if (!confirmed) return;

  const deletedCollectBase = currentContactsBase === baseId;
  const deletedSendBase = currentSendBase === baseId;

  try {
    const result = await window.api.baseDelete(baseId);
    if (!result?.ok) {
      throw new Error(result?.error || 'Не удалось удалить базу');
    }

    const hasBases = await refreshBaseCatalog({
      preferredCollectBase: deletedCollectBase ? '' : currentContactsBase,
      preferredSendBase: deletedSendBase ? '' : currentSendBase,
      silent: true,
    });

    if (deletedCollectBase) {
      if (hasBases) {
        await loadContactsBaseNew(currentContactsBase, { silent: true, refreshCatalog: false });
      } else {
        replaceContacts([]);
        renderContactList();
      }
    } else {
      updateBaseSummaryCards();
      updateDashboardSummary();
    }

    setStatus(getBaseStatusId(target), `База удалена: ${base.name}`, 'warn');
    if (deletedSendBase && currentSendBase) {
      setStatus('sendStatus', `База удалена. Активна «${getBaseLabel(currentSendBase)}».`, 'warn');
    }
    showToast(`База «${base.name}» удалена`, 'warn');
  } catch (error) {
    reportError('Не удалось удалить базу', error, { statusId: getBaseStatusId(target) });
  }
}

function normalizeMessageStoreForUi(rawStore) {
  if (Array.isArray(rawStore)) {
    return {
      version: 2,
      activeFolderId: 'default',
      folders: [{
        id: 'default',
        name: 'Основные сообщения',
        variants: rawStore.length ? rawStore : [''],
        image: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  }

  const folders = Array.isArray(rawStore?.folders) ? rawStore.folders.filter(Boolean) : [];
  const normalizedFolders = folders.length ? folders.map((folder, index) => ({
    id: String(folder.id || `folder-${index}`),
    name: String(folder.name || `Папка сообщений ${index + 1}`).trim() || `Папка сообщений ${index + 1}`,
    variants: Array.isArray(folder.variants) && folder.variants.length ? folder.variants.map((item) => String(item || '')) : [''],
    image: folder.image || null,
    createdAt: Number(folder.createdAt || Date.now()),
    updatedAt: Number(folder.updatedAt || Date.now()),
  })) : [{
    id: 'default',
    name: 'Основные сообщения',
    variants: [''],
    image: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }];

  const activeFolderId = normalizedFolders.some((folder) => folder.id === rawStore?.activeFolderId)
    ? rawStore.activeFolderId
    : normalizedFolders[0].id;

  return { version: 2, activeFolderId, folders: normalizedFolders };
}

function getMessageFolderById(folderId) {
  return messageFolders.find((folder) => folder.id === folderId) || null;
}

function getActiveMessageFolder() {
  return getMessageFolderById(currentMessageFolderId) || messageFolders[0] || null;
}

function syncCurrentFolderFromMessages() {
  const folder = getActiveMessageFolder();
  if (!folder) return;
  folder.variants = messages.map((message) => String(message || ''));
  folder.updatedAt = Date.now();
  messageStore.activeFolderId = folder.id;
}

function applyMessageStore(rawStore, { render = true } = {}) {
  messageStore = normalizeMessageStoreForUi(rawStore);
  messageFolders = messageStore.folders;
  currentMessageFolderId = messageStore.activeFolderId || messageFolders[0]?.id || '';
  persistUiSetting(STORAGE_KEYS.messageFolder, currentMessageFolderId);

  const folder = getActiveMessageFolder();
  messages = folder?.variants?.length ? folder.variants.slice() : [''];
  selectedImagePath = folder?.image?.path || null;

  renderMessageFolderOptions();
  renderMessageFolderSummary();
  renderMessageFolderImage();
  renderSendContentSummary();
  if (render) renderMessages();
  updateDashboardSummary();
}

async function loadMessageStore() {
  try {
    const rawStore = await window.api.messagesLoad();
    const preferredFolderId = localStorage.getItem(STORAGE_KEYS.messageFolder);
    if (preferredFolderId && rawStore?.folders?.some?.((folder) => folder.id === preferredFolderId)) {
      rawStore.activeFolderId = preferredFolderId;
    }
    applyMessageStore(rawStore);
  } catch (error) {
    reportError('Не удалось загрузить папки сообщений', error, { statusId: 'sendStatus' });
    applyMessageStore({ folders: [] });
  }
}

function buildMessageStorePayload() {
  syncCurrentFolderFromMessages();
  return {
    version: 2,
    activeFolderId: currentMessageFolderId,
    folders: messageFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      variants: Array.isArray(folder.variants) ? folder.variants : [''],
      image: folder.image ? {
        fileName: folder.image.fileName,
        originalName: folder.image.originalName,
        size: folder.image.size,
        updatedAt: folder.image.updatedAt,
      } : null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    })),
  };
}

function renderMessageFolderOptions() {
  const optionsHtml = messageFolders.length
    ? messageFolders.map((folder) => `<option value="${escHtml(folder.id)}" title="${escHtml(folder.name)}">${escHtml(folder.name)}</option>`).join('')
    : '<option value="">Нет папок</option>';

  ['messageFolderSelect', 'sendMessageFolderId'].forEach((id) => {
    const select = getEl(id);
    if (!select) return;
    select.innerHTML = optionsHtml;
    select.value = currentMessageFolderId || messageFolders[0]?.id || '';
    select.disabled = !messageFolders.length || isSending;
  });
  renderMessageFolderRail();
  updateMessageFolderButtons();
}

function renderMessageFolderRail() {
  const rail = getEl('messageFolderRail');
  if (!rail) return;

  if (!messageFolders.length) {
    rail.innerHTML = '';
    return;
  }

  rail.innerHTML = messageFolders
    .map((folder) => `
      <button
        class="folder-rail-btn ${folder.id === currentMessageFolderId ? 'is-active' : ''}"
        type="button"
        data-folder-rail-id="${escHtml(folder.id)}"
        title="${escHtml(folder.name)}"
        ${isSending ? 'disabled' : ''}
      >
        ${escHtml(folder.name)}
      </button>
    `)
    .join('');
}

function updateMessageFolderButtons() {
  const hasFolders = messageFolders.length > 0;
  const lockEditing = isSending;
  const buttons = [
    ['btnCreateMessageFolder', lockEditing],
    ['btnRenameMessageFolder', !hasFolders || lockEditing],
    ['btnDeleteMessageFolder', messageFolders.length <= 1 || lockEditing],
    ['btnSelectMessageImage', !hasFolders || lockEditing],
  ];

  buttons.forEach(([id, disabled]) => {
    const button = getEl(id);
    if (button) button.disabled = disabled;
  });
}

function renderMessageFolderSummary() {
  const folder = getActiveMessageFolder();
  const nameEl = getEl('messageFolderSummaryName');
  const metaEl = getEl('messageFolderSummaryMeta');

  if (nameEl) {
    nameEl.textContent = folder?.name || 'Папка не выбрана';
    nameEl.title = folder?.name || '';
  }

  if (metaEl) {
    metaEl.textContent = folder
      ? `${formatCountRu(getFolderVariantCount(folder), RU_FORMS.variant)} • ${getFolderImageText(folder)}`
      : 'Создайте папку сообщений';
  }
}

function renderMessageFolderImage() {
  const folder = getActiveMessageFolder();
  const image = folder?.image || null;

  [
    ['folderImagePreview', 'folderImageThumb', 'folderImageName'],
    ['imagePreview', 'imageThumb', 'imageName'],
  ].forEach(([previewId, thumbId, nameId]) => {
    const preview = getEl(previewId);
    const thumb = getEl(thumbId);
    const nameEl = getEl(nameId);

    if (preview) preview.style.display = image?.path ? 'flex' : 'none';
    if (thumb) thumb.src = image?.path ? `file://${image.path}` : '';
    if (nameEl) {
      nameEl.textContent = image?.originalName || '';
      nameEl.title = image?.originalName || '';
    }
  });
  updatePreview();
}

function renderSendContentSummary() {
  const folder = getActiveMessageFolder();
  const summary = getEl('sendMessageFolderSummary');
  if (!summary) return;

  if (!folder) {
    summary.textContent = 'Папка сообщений не выбрана.';
    return;
  }

  summary.textContent = formatMessageFolderLine(folder);
  summary.title = folder.name;
}

async function saveMessagesStore({ silent = false, render = false } = {}) {
  try {
    const result = await window.api.messagesSave(buildMessageStorePayload());
    if (!result?.ok) throw new Error(result?.error || 'Не удалось сохранить папки сообщений');
    if (result.store) applyMessageStore(result.store, { render });
    return true;
  } catch (error) {
    reportError('Не удалось сохранить папки сообщений', error, {
      statusId: 'sendStatus',
      toast: !silent,
      log: false,
    });
    return false;
  }
}

async function selectMessageFolder(folderId) {
  const nextFolder = getMessageFolderById(folderId);
  if (!nextFolder) return;

  syncCurrentFolderFromMessages();
  try {
    await window.api.messagesSave(buildMessageStorePayload());
  } catch (error) {
    reportError('Не удалось сохранить текущую папку сообщений', error, { toast: false, log: false });
  }
  currentMessageFolderId = nextFolder.id;
  messageStore.activeFolderId = nextFolder.id;
  messages = nextFolder.variants?.length ? nextFolder.variants.slice() : [''];
  selectedImagePath = nextFolder.image?.path || null;
  persistUiSetting(STORAGE_KEYS.messageFolder, currentMessageFolderId);
  renderMessageFolderOptions();
  renderMessageFolderSummary();
  renderMessageFolderImage();
  renderSendContentSummary();
  renderMessages();

  try {
    await window.api.messageFolderActive(currentMessageFolderId);
  } catch (error) {
    reportError('Не удалось выбрать папку сообщений', error, { toast: false, log: false });
  }
}

async function createMessageFolder() {
  if (isSending) return;
  const name = await requestBaseName('Введите название папки сообщений', '', {
    placeholder: 'Название папки сообщений',
    existingItems: messageFolders,
    emptyMessage: 'Введите название папки сообщений',
    duplicateMessage: 'Папка с таким названием уже есть',
  });
  if (!name) return;

  try {
    const result = await window.api.messageFolderCreate(name);
    if (!result?.ok) throw new Error(result?.error || 'Не удалось создать папку сообщений');
    applyMessageStore(result.store);
    showToast(`Папка «${name}» создана`, 'ok');
  } catch (error) {
    reportError('Не удалось создать папку сообщений', error, { statusId: 'sendStatus' });
  }
}

async function renameMessageFolder() {
  if (isSending) return;
  const folder = getActiveMessageFolder();
  if (!folder) return;

  const name = await requestBaseName('Введите новое название папки', folder.name, {
    placeholder: 'Название папки сообщений',
    existingItems: messageFolders,
    currentId: folder.id,
    emptyMessage: 'Введите название папки сообщений',
    duplicateMessage: 'Папка с таким названием уже есть',
  });
  if (!name || name === folder.name) return;

  try {
    const result = await window.api.messageFolderRename({ id: folder.id, name });
    if (!result?.ok) throw new Error(result?.error || 'Не удалось переименовать папку сообщений');
    applyMessageStore(result.store);
    showToast(`Папка переименована в «${name}»`, 'ok');
  } catch (error) {
    reportError('Не удалось переименовать папку сообщений', error, { statusId: 'sendStatus' });
  }
}

async function deleteMessageFolder() {
  if (isSending) return;
  const folder = getActiveMessageFolder();
  if (!folder) return;

  const confirmed = await showConfirmDialog({
    title: 'Удалить папку сообщений?',
    body: `Удалить папку «${escHtml(folder.name)}»? Все варианты сообщений${folder.image?.path ? ' и прикреплённое изображение' : ''} будут удалены.`,
    confirmText: 'Удалить',
    tone: 'danger',
  });
  if (!confirmed) return;

  try {
    const result = await window.api.messageFolderDelete(folder.id);
    if (!result?.ok) throw new Error(result?.error || 'Не удалось удалить папку сообщений');
    applyMessageStore(result.store);
    showToast(`Папка «${folder.name}» удалена`, 'warn');
  } catch (error) {
    reportError('Не удалось удалить папку сообщений', error, { statusId: 'sendStatus' });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentContactsBase = localStorage.getItem(STORAGE_KEYS.contactsBase) || '';
    currentSendBase = localStorage.getItem(STORAGE_KEYS.sendBase) || '';
    currentActiveAccountId = localStorage.getItem(STORAGE_KEYS.activeAccount) || '';
    currentSendAccountId = localStorage.getItem(STORAGE_KEYS.sendAccount) || '';
    loadUiSettings();
    bindUiPersistence();
    bindCollectPresets();
    updateCollectPresetState();
    updateSendRepeatModeUi();
    await loadMessageStore();

    await refreshBaseCatalog({
      preferredCollectBase: currentContactsBase,
      preferredSendBase: currentSendBase,
      silent: true,
    });
    await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId,
      preferredSendAccount: currentSendAccountId,
      silent: true,
    });

    const contactBaseSelect = getEl('contactBaseType');
    if (contactBaseSelect && !contactBaseSelect.dataset.bound) {
      contactBaseSelect.dataset.bound = '1';
      contactBaseSelect.addEventListener('change', async () => {
        if (isCollecting) return;
        persistUiSetting(STORAGE_KEYS.contactsBase, contactBaseSelect.value);
        await loadContactsBase(contactBaseSelect.value);
      });
    }

    const sendBaseSelect = getEl('sendBaseType');
    if (sendBaseSelect && !sendBaseSelect.dataset.bound) {
      sendBaseSelect.dataset.bound = '1';
      sendBaseSelect.addEventListener('change', () => {
        currentSendBase = resolveBaseId(sendBaseSelect.value, currentContactsBase);
        persistUiSetting(STORAGE_KEYS.sendBase, currentSendBase);
        syncBaseSelections();
        updateBaseSummaryCards();
        updateDashboardSummary();
      });
    }

    const messageFolderSelect = getEl('messageFolderSelect');
    if (messageFolderSelect && !messageFolderSelect.dataset.bound) {
      messageFolderSelect.dataset.bound = '1';
      messageFolderSelect.addEventListener('change', async () => {
        await selectMessageFolder(messageFolderSelect.value);
      });
    }

    const sendMessageFolderSelect = getEl('sendMessageFolderId');
    if (sendMessageFolderSelect && !sendMessageFolderSelect.dataset.bound) {
      sendMessageFolderSelect.dataset.bound = '1';
      sendMessageFolderSelect.addEventListener('change', async () => {
        await selectMessageFolder(sendMessageFolderSelect.value);
      });
    }

    const messageFolderRail = getEl('messageFolderRail');
    if (messageFolderRail && !messageFolderRail.dataset.bound) {
      messageFolderRail.dataset.bound = '1';
      messageFolderRail.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-folder-rail-id]');
        if (!button) return;
        await selectMessageFolder(button.dataset.folderRailId);
      });
    }

    const contactSearch = getEl('contactSearch');
    if (contactSearch && !contactSearch.dataset.bound) {
      contactSearch.dataset.bound = '1';
      contactSearch.addEventListener('input', () => {
        clearTimeout(contactSearchTimer);
        contactSearchTimer = setTimeout(() => renderContactList({ resetScroll: true, syncDashboard: false }), CONTACT_SEARCH_DEBOUNCE_MS);
      });
    }

    const contactList = getEl('contactList');
    if (contactList && !contactList.dataset.bound) {
      contactList.dataset.bound = '1';
      contactList.addEventListener('scroll', () => renderContactList({ syncDashboard: false }));
    }

    window.addEventListener('resize', () => renderContactList({ syncDashboard: false }));

    const aiTestInput = getEl('aiTestInput');
    if (aiTestInput && !aiTestInput.dataset.bound) {
      aiTestInput.dataset.bound = '1';
      aiTestInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') sendAiTest();
      });
    }

    const sendAccountSelect = getEl('sendAccountId');
    if (sendAccountSelect && !sendAccountSelect.dataset.bound) {
      sendAccountSelect.dataset.bound = '1';
      sendAccountSelect.addEventListener('change', () => {
        currentSendAccountId = resolveAccountId(sendAccountSelect.value, currentActiveAccountId);
        persistUiSetting(STORAGE_KEYS.sendAccount, currentSendAccountId);
        renderAccountSelectOptions();
        updateAccountSummary();
      });
    }

    const accountsList = getEl('waAccountsList');
    if (accountsList && !accountsList.dataset.bound) {
      accountsList.dataset.bound = '1';
      accountsList.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-account-action]');
        if (!actionButton) return;
        try {
          await handleAccountAction(actionButton.dataset.accountAction, actionButton.dataset.accountId);
        } catch (error) {
          reportError('Не удалось выполнить действие с аккаунтом', error, { statusId: 'connectStatus' });
        }
      });
    }

    if (bases.length) {
      await loadContactsBaseNew(currentContactsBase, { silent: true, refreshCatalog: false });
    } else {
      replaceContacts([]);
      renderContactList();
      setStatus('collectStatus', 'Создайте первую базу для сбора контактов.', 'warn');
      setStatus('sendStatus', 'Создайте базу и выберите её перед рассылкой.', 'warn');
    }

    window.api.on('wa-event', handleWaEvent);
    window.api.on('send-progress', handleProgress);
    window.api.on('update-event', lfHandleUpdateEvent);
    loadAppVersion();
    loadAiConfigStatus();
    loadBillzStatus();

    const savedTheme = getStoredTheme();
    applyTheme(savedTheme);

    void checkStatus(currentActiveAccountId);
    startWhatsAppStatusPolling();
    updateSendProgressSummary();
    setCollectState('Подготовка', 'neutral');
    setSendState('Ожидание', 'neutral');
    renderAiManager();

    const bind = (id, fn) => {
      const el = getEl(id);
      if (!el || el.getAttribute('onclick')) return;
      el.addEventListener('click', fn);
    };

    bind('btnOpenWA',      openWhatsApp);
    bind('btnCheckStatus', checkStatus);
    bind('btnCollect',     collectContacts);
    bind('btnCollectStop', stopCollect);
    bind('btnStart',       startSending);
    bind('btnStop',        stopSending);
    bind('btnTest',        sendTest);
    bind('btnAddVariant',  addVariant);
    bind('btnClearLog',    clearLog);

    [
      ['btnCreateBase', () => createBase('contacts')],
      ['btnRenameBase', () => renameBase('contacts')],
      ['btnDeleteBase', () => deleteBase('contacts')],
      ['btnCreateBaseSend', () => createBase('send')],
      ['btnRenameBaseSend', () => renameBase('send')],
      ['btnDeleteBaseSend', () => deleteBase('send')],
    ].forEach(([id, fn]) => {
      const el = getEl(id);
      if (!el || el.dataset.boundClick) return;
      el.removeAttribute('onclick');
      el.dataset.boundClick = '1';
      el.addEventListener('click', fn);
    });

    updateBaseSummaryCards();
    updateBaseActionButtons();
    maybeShowOnboarding();
  } catch (error) {
    reportError('Ошибка инициализации интерфейса', error);
  }
});

const LEGACY_ONBOARDING_STEPS = [
  {
    selector: '[data-onboarding-target="whatsapp"]',
    title: 'Подключите WhatsApp',
    text: 'Нажмите кнопку подключения и войдите в нужный аккаунт.',
  },
  {
    selector: '[data-onboarding-target="contacts"]',
    title: 'Соберите базу контактов',
    text: 'Перейдите к сбору и сохраните контакты в выбранную базу.',
  },
  {
    selector: '[data-onboarding-target="messages"]',
    title: 'Создайте сообщения',
    text: 'Подготовьте папку сообщений и несколько вариантов текста.',
  },
  {
    selector: '[data-onboarding-target="send"]',
    title: 'Запустите рассылку',
    text: 'Проверьте тестовую отправку и запускайте рассылку.',
  },
];

const ONBOARDING_STEPS = [
  {
    page: 'connect',
    selector: '[data-onboarding-target="whatsapp"]',
    title: 'Подключение WhatsApp',
    points: ['Нажмите «Подключить».', 'Отсканируйте QR-код в WhatsApp.', 'Сессия сохранится автоматически.'],
  },
  {
    page: 'connect',
    selector: '[data-onboarding-target="accounts"]',
    title: 'Аккаунты WhatsApp',
    points: ['Можно подключить до 3 аккаунтов.', 'Активный аккаунт используется для сбора и рассылки.', 'Аккаунты можно переименовать.'],
  },
  {
    page: 'contacts',
    selector: '[data-onboarding-target="collectPanel"]',
    title: 'Сбор базы',
    points: ['Выберите базу и количество контактов.', 'Нажмите «Собрать».', 'Процесс можно остановить в любой момент.'],
  },
  {
    page: 'contacts',
    selector: '[data-onboarding-target="bases"]',
    title: 'Базы',
    points: ['Создавайте, переименовывайте и удаляйте базы.', 'Импортируйте и экспортируйте CSV.', 'Поиск быстро находит контакт по имени, чату или номеру.'],
  },
  {
    page: 'compose',
    selector: '[data-onboarding-target="messageFolders"]',
    title: 'Папки сообщений',
    points: ['Создайте папку сообщений.', 'Добавьте несколько вариантов текста.', 'Можно прикрепить изображение, а текст при рассылке выберется случайно.'],
  },
  {
    page: 'compose',
    selector: '[data-onboarding-target="aiHelper"]',
    title: 'ИИ помощник',
    points: ['Здесь можно создать новое сообщение или улучшить уже готовый текст.', 'Просто выберите режим и попробуйте.'],
  },
  {
    page: 'send',
    selector: '[data-onboarding-target="testSend"]',
    title: 'Тестовая отправка',
    points: ['Перед рассылкой лучше сделать тест.', 'Можно выбрать до 5 контактов.', 'Тест не влияет на основную рассылку.'],
  },
  {
    page: 'send',
    selector: '[data-onboarding-target="sendSetup"]',
    title: 'Рассылка',
    points: ['Выберите базу и WhatsApp-аккаунт.', 'Выберите папку сообщений.', 'Настройте задержку и запустите рассылку.'],
  },
  {
    page: 'send',
    selector: '[data-onboarding-target="safeMode"]',
    title: 'Безопасный режим',
    points: ['Задержки и паузы делают отправку аккуратнее.', 'Не стоит отправлять слишком много сообщений за раз.'],
  },
  {
    page: 'ai-manager',
    selector: '[data-onboarding-target="aiManagerIntro"]',
    title: 'ИИ менеджер',
    points: ['auto означает автоматический ответ.', 'suggest означает, что есть предложенный вариант.', 'handoff означает, что нужно ответить вручную.'],
  },
  {
    page: 'ai-manager',
    selector: '[data-onboarding-target="aiManagerNotify"]',
    title: 'Уведомления ИИ',
    points: ['У suggest мягкий короткий звук.', 'У handoff более заметный сигнал.', 'Кнопка проверки подсвечивает важные чаты.'],
  },
  {
    page: 'ai-manager',
    selector: '[data-onboarding-target="aiManagerFilters"]',
    title: 'Поиск и фильтры ИИ',
    points: ['Ищите чат по имени или номеру.', 'Фильтры помогают быстро открыть автоответы, предложения и ручные обращения.'],
  },
  {
    page: 'connect',
    selector: '[data-onboarding-target="tourButton"]',
    title: 'Где пройти обучение снова',
    points: ['Вы всегда можете пройти обучение снова через кнопку «Показать обучение» на главной странице.'],
  },
];

let onboardingLayer = null;
let onboardingStepIndex = 0;
let onboardingResizeHandler = null;

function markOnboardingDone() {
  persistUiSetting(STORAGE_KEYS.onboardingDone, '1');
  persistUiSetting(STORAGE_KEYS.hasSeenOnboarding, 'true');
}

function maybeShowOnboarding() {
  if (localStorage.getItem(STORAGE_KEYS.hasSeenOnboarding) === 'true' || localStorage.getItem(STORAGE_KEYS.onboardingDone) === '1') return;
  setTimeout(async () => {
    if (localStorage.getItem(STORAGE_KEYS.hasSeenOnboarding) === 'true' || localStorage.getItem(STORAGE_KEYS.onboardingDone) === '1') return;
    const wantsTour = await showConfirmDialog({
      title: 'Хотите пройти обучение?',
      body: 'Покажем основные шаги: подключение WhatsApp, сбор базы, сообщения и запуск рассылки.',
      confirmText: 'Да',
      cancelText: 'Пропустить',
      tone: 'primary',
    });

    if (wantsTour) {
      startOnboarding();
    } else {
      markOnboardingDone();
    }
  }, 700);
}

function startOnboarding(manual = false) {
  if (onboardingLayer) finishOnboarding({ remember: false });
  switchPage('connect');
  onboardingStepIndex = 0;
  onboardingLayer = document.createElement('div');
  onboardingLayer.className = 'onboarding-layer';
  onboardingLayer.innerHTML = `
    <div class="onboarding-dim"></div>
    <div class="onboarding-highlight"></div>
    <div class="onboarding-card"></div>
  `;
  document.body.appendChild(onboardingLayer);
  onboardingResizeHandler = () => positionOnboardingStep();
  window.addEventListener('resize', onboardingResizeHandler);
  if (manual) persistUiSetting(STORAGE_KEYS.hasSeenOnboarding, 'true');
  renderOnboardingStep();
}

function getSeenFeatures() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.seenFeatures) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markFeaturesSeen(features = []) {
  const next = Array.from(new Set([...getSeenFeatures(), ...features]));
  persistUiSetting(STORAGE_KEYS.seenFeatures, JSON.stringify(next));
}

function startFeatureOnboarding(features = []) {
  if (document.querySelector('.whats-new-overlay') || onboardingLayer) {
    setTimeout(() => startFeatureOnboarding(features), 500);
    return;
  }
  const steps = [];
  if (features.includes('ai_api_setup')) {
    steps.push({
      page: 'compose',
      selector: '[data-onboarding-target="aiApiSetup"]',
      title: 'ИИ помощник',
      points: ['Чтобы использовать ИИ, нужно ввести API ключ.', 'После этого можно создавать и улучшать тексты.'],
    });
  }
  if (features.includes('ai_basic')) {
    steps.push({
      page: 'compose',
      selector: '[data-onboarding-target="aiHelper"]',
      title: 'ИИ помощник',
      points: ['Создавайте новые сообщения или улучшайте готовые тексты.', 'Оценки помогают ИИ учитывать ваш вкус в следующих ответах.'],
    });
  }
  if (features.includes('ai_manager_ui_122')) {
    steps.push(
      {
        page: 'ai-manager',
        selector: '[data-onboarding-target="aiManagerIntro"]',
        title: 'Статусы ИИ менеджера',
        points: ['auto: ИИ ответил автоматически.', 'suggest: ИИ предлагает ответ.', 'handoff: требуется ваш ответ.'],
      },
      {
        page: 'ai-manager',
        selector: '[data-onboarding-target="aiManagerNotify"]',
        title: 'Звуковые уведомления',
        points: ['Мягкий звук означает новое предложение.', 'Более заметный сигнал означает, что нужен человек.', 'Звук срабатывает только на новое событие.'],
      },
      {
        page: 'ai-manager',
        selector: '[data-onboarding-target="aiManagerFilters"]',
        title: 'Поиск и фильтры',
        points: ['Ищите чат по имени или номеру.', 'Фильтруйте auto, suggest и handoff.', 'Кнопка проверки подсветит важные чаты.'],
      }
    );
  }
  if (!steps.length) return;
  const originalSteps = ONBOARDING_STEPS.slice();
  ONBOARDING_STEPS.length = 0;
  ONBOARDING_STEPS.push(...steps);
  startOnboarding(true);
  const restoreTimer = setInterval(() => {
    if (onboardingLayer) return;
    clearInterval(restoreTimer);
    ONBOARDING_STEPS.length = 0;
    ONBOARDING_STEPS.push(...originalSteps);
    markFeaturesSeen(features);
  }, 250);
}

function maybeShowNewFeatureOnboarding(currentVersion) {
  if (!currentVersion || compareVersions(currentVersion, '1.2.1') < 0) return;
  const seen = getSeenFeatures();
  const unseen = NEW_FEATURES.filter((feature) => !seen.includes(feature));
  if (!unseen.length) return;
  setTimeout(() => startFeatureOnboarding(unseen), 500);
}

function finishOnboarding({ remember = true } = {}) {
  if (remember) markOnboardingDone();
  if (onboardingResizeHandler) {
    window.removeEventListener('resize', onboardingResizeHandler);
    onboardingResizeHandler = null;
  }
  onboardingLayer?.remove();
  onboardingLayer = null;
}

function renderOnboardingStep() {
  if (!onboardingLayer) return;
  const step = ONBOARDING_STEPS[onboardingStepIndex];
  if (!step) {
    finishOnboarding();
    return;
  }

  if (step.page) switchPage(step.page);
  const card = onboardingLayer.querySelector('.onboarding-card');
  const isLast = onboardingStepIndex === ONBOARDING_STEPS.length - 1;
  const stepBody = Array.isArray(step.points) && step.points.length
    ? `<ul class="onboarding-list">${step.points.map((point) => `<li>${escHtml(point)}</li>`).join('')}</ul>`
    : `<div class="onboarding-text">${escHtml(step.text || '')}</div>`;
  card.innerHTML = `
    <div class="onboarding-step">Шаг ${onboardingStepIndex + 1} из ${ONBOARDING_STEPS.length}</div>
    <div class="onboarding-title">${escHtml(step.title)}</div>
    ${stepBody}
    <div class="onboarding-actions">
      <button class="btn btn-ghost btn-sm" type="button" id="onboardingSkip">Пропустить</button>
      <button class="btn btn-primary btn-sm" type="button" id="onboardingNext">${isLast ? 'Готово' : 'Далее'}</button>
    </div>
  `;

  const stepLabel = card.querySelector('.onboarding-step');
  if (stepLabel) stepLabel.textContent = `Шаг ${onboardingStepIndex + 1} из ${ONBOARDING_STEPS.length}`;
  const skipButton = card.querySelector('#onboardingSkip');
  const nextButton = card.querySelector('#onboardingNext');
  if (skipButton) skipButton.textContent = 'Пропустить';
  if (nextButton) nextButton.textContent = isLast ? 'Готово' : 'Далее';
  if (skipButton) {
    const prevButton = document.createElement('button');
    prevButton.className = 'btn btn-secondary btn-sm';
    prevButton.type = 'button';
    prevButton.id = 'onboardingPrev';
    prevButton.textContent = 'Назад';
    prevButton.disabled = onboardingStepIndex === 0;
    skipButton.insertAdjacentElement('afterend', prevButton);
  }

  card.querySelector('#onboardingSkip')?.addEventListener('click', finishOnboarding);
  card.querySelector('#onboardingPrev')?.addEventListener('click', () => {
    if (onboardingStepIndex <= 0) return;
    onboardingStepIndex -= 1;
    renderOnboardingStep();
  });
  card.querySelector('#onboardingNext')?.addEventListener('click', () => {
    onboardingStepIndex += 1;
    renderOnboardingStep();
  });

  requestAnimationFrame(() => requestAnimationFrame(() => positionOnboardingStep()));
}

function positionOnboardingStep() {
  if (!onboardingLayer) return;
  const step = ONBOARDING_STEPS[onboardingStepIndex];
  const target = step ? document.querySelector(step.selector) : null;
  const highlight = onboardingLayer.querySelector('.onboarding-highlight');
  const card = onboardingLayer.querySelector('.onboarding-card');
  if (!highlight || !card) return;

  if (!target) {
    highlight.style.display = 'none';
    card.style.left = `${Math.max(16, (window.innerWidth - card.offsetWidth) / 2)}px`;
    card.style.top = `${Math.max(16, (window.innerHeight - card.offsetHeight) / 2)}px`;
    return;
  }

  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  const rect = target.getBoundingClientRect();
  const viewportPad = 14;
  const pad = 8;
  const safeLeft = Math.max(viewportPad, rect.left - pad);
  const safeTop = Math.max(viewportPad, rect.top - pad);
  const safeRight = Math.min(window.innerWidth - viewportPad, rect.right + pad);
  const safeBottom = Math.min(window.innerHeight - viewportPad, rect.bottom + pad);
  highlight.style.display = 'block';
  highlight.style.left = `${safeLeft}px`;
  highlight.style.top = `${safeTop}px`;
  highlight.style.width = `${Math.max(44, safeRight - safeLeft)}px`;
  highlight.style.height = `${Math.max(40, safeBottom - safeTop)}px`;

  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  let left = Math.min(Math.max(viewportPad, safeLeft), window.innerWidth - cardWidth - viewportPad);
  let top = safeBottom + 14;

  if (top + cardHeight > window.innerHeight - viewportPad) {
    top = safeTop - cardHeight - 14;
  }
  if (top < viewportPad) top = viewportPad;
  if (left < viewportPad) left = viewportPad;

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// ─── Theme ───────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : '');
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'dark' ? 'Светлая' : 'Тёмная';
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  updateDashboardSummary();
}

function toggleTheme() {
  const current = getStoredTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── Image selection ─────────────────────────────────────────────
async function selectImage() {
  try {
    const folder = getActiveMessageFolder();
    if (!folder) {
      showToast('Сначала создайте папку сообщений', 'err');
      return;
    }

    if (folder.image?.path) {
      const confirmed = await showConfirmDialog({
        title: 'Заменить изображение?',
        body: `Заменить изображение в папке «${escHtml(folder.name)}»? Текущее изображение будет удалено из хранилища приложения.`,
        confirmText: 'Заменить',
        tone: 'primary',
      });
      if (!confirmed) return;
    }

    const res = await window.api.messageFolderImageSelect(folder.id);
    if (!res || !res.ok) {
      if (res?.error) throw new Error(res.error);
      return;
    }

    applyMessageStore(res.store, { render: false });
    showToast('Изображение сохранено в папке сообщений', 'ok');
  } catch (error) {
    reportError('Не удалось выбрать изображение', error, { statusId: 'sendStatus' });
  }
}

async function clearImage() {
  const folder = getActiveMessageFolder();
  if (!folder?.image?.path) return;

  const confirmed = await showConfirmDialog({
    title: 'Удалить изображение?',
    body: `Удалить изображение из папки «${escHtml(folder.name)}»? Варианты сообщений останутся на месте.`,
    confirmText: 'Удалить',
    tone: 'danger',
  });
  if (!confirmed) return;

  try {
    const res = await window.api.messageFolderImageDelete(folder.id);
    if (!res?.ok) throw new Error(res?.error || 'Не удалось удалить изображение');
    applyMessageStore(res.store, { render: false });
    showToast('Изображение удалено', 'warn');
  } catch (error) {
    reportError('Не удалось удалить изображение', error, { statusId: 'sendStatus' });
  }
}

// ─── Navigation ──────────────────────────────────────────────────
function switchPage(pageId, el) {
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = getEl('page-' + pageId);
    if (page) page.classList.add('active');
    const navItem = el || document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    if (pageId === 'contacts') renderContactList({ syncDashboard: false });
    if (pageId === 'compose') updatePreview();
    if (pageId === 'ai-manager') renderAiManager();
  } catch (error) {
    reportError('Не удалось переключить страницу', error, { toast: false, log: false });
  }
}

// ─── Connection ───────────────────────────────────────────────────
async function openWhatsApp(accountId = currentActiveAccountId) {
  if (isOpeningWhatsApp) return;

  const resolvedAccountId = resolveAccountId(accountId, currentActiveAccountId);
  if (!resolvedAccountId) {
    setConnectStatus('Нет доступного аккаунта WhatsApp.', 'err');
    return;
  }

  const btn = getEl('btnOpenWA');
  isOpeningWhatsApp = true;
  currentActiveAccountId = resolvedAccountId;
  persistUiSetting(STORAGE_KEYS.activeAccount, currentActiveAccountId);
  if (!currentSendAccountId) {
    currentSendAccountId = resolvedAccountId;
    persistUiSetting(STORAGE_KEYS.sendAccount, currentSendAccountId);
  }
  renderAccountsPanel();

  if (btn) {
    btn.disabled = true;
    btn.dataset.state = 'loading';
    btn.innerHTML = `<span class="spin">⟳</span> Запуск...`;
  }
  setConnectStatus(`Открываем ${getAccountLabel(resolvedAccountId)}...`, 'warn');

  try {
    await setActiveAccountUi(resolvedAccountId, { silent: true });
    const res = await window.api.waOpen(resolvedAccountId);
    if (res?.ok) {
      await refreshAccounts({
        preferredActiveAccount: resolvedAccountId,
        preferredSendAccount: currentSendAccountId,
        silent: true,
      });
      void checkStatus(resolvedAccountId);
      setConnectStatus(`${getAccountLabel(resolvedAccountId)} открыт. Сканируйте QR-код при необходимости.`, 'warn');
    } else {
      const message = res?.error || 'Не удалось открыть WhatsApp';
      setConnectStatus('Ошибка: ' + message, 'err');
      showToast('Ошибка открытия WhatsApp', 'err');
      if (btn) {
        btn.disabled = false;
        btn.dataset.state = 'idle';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Подключить`;
      }
    }
  } catch (error) {
    reportError('Ошибка запуска WhatsApp', error, { statusId: 'connectStatus' });
    if (btn) {
      btn.disabled = false;
      btn.dataset.state = 'idle';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Подключить`;
    }
  } finally {
    isOpeningWhatsApp = false;
    renderAccountsPanel();
    renderAccountSelectOptions();
    updateAccountSummary();
  }
}

async function checkStatus(accountId = currentActiveAccountId) {
  const resolvedAccountId = resolveAccountId(accountId, currentActiveAccountId);
  if (!resolvedAccountId) {
    applyWhatsAppStatus('offline');
    return 'offline';
  }

  if (waStatusCheckPromises.has(resolvedAccountId)) {
    return waStatusCheckPromises.get(resolvedAccountId);
  }

  const promise = (async () => {
    try {
      const rawStatus = window.api.checkStatus
        ? await window.api.checkStatus(resolvedAccountId)
        : await window.api.waStatus(resolvedAccountId);

      const status = normalizeWhatsAppStatus(rawStatus);
      const account = getAccountById(resolvedAccountId);
      if (account) account.status = status;
      if (resolvedAccountId === currentActiveAccountId) {
        applyWhatsAppStatus(status);
      }
      renderAccountsPanel();
      renderAccountSelectOptions();
      updateAccountSummary();
      return status;
    } catch (error) {
      reportError('Не удалось проверить статус WhatsApp', error, {
        toast: false,
        log: false,
      });
      const account = getAccountById(resolvedAccountId);
      if (account) account.status = 'error';
      if (resolvedAccountId === currentActiveAccountId) {
        applyWhatsAppStatus('error');
      }
      renderAccountsPanel();
      updateAccountSummary();
      return 'error';
    } finally {
      waStatusCheckPromises.delete(resolvedAccountId);
    }
  })();

  waStatusCheckPromises.set(resolvedAccountId, promise);
  return promise;
}

function setConnected(yes) {
  applyWhatsAppStatus(yes ? 'connected' : 'loading');
}

function setConnectStatus(msg, type = '') {
  const el = getEl('connectStatus');
  if (!el) return;
  el.className = 'status-bar ' + type;
  el.textContent = msg;
  if (type === 'ok') setConnectState('Готово', 'success');
  if (type === 'warn') setConnectState('Ожидание', 'warning');
  if (type === 'err') setConnectState('Ошибка', 'error');
  if (!type) setConnectState('Проверка', 'neutral');
}

// ─── WA Event Handler ────────────────────────────────────────────
function handleWaEvent(data) {
  if (!data || !data.type) return;
  const eventAccountId = resolveAccountId(data.accountId, currentActiveAccountId);
  const account = getAccountById(eventAccountId);
  if (account && ['opened', 'connected', 'timeout'].includes(data.type)) {
    account.status = data.type === 'connected' ? 'connected' : 'loading';
  }

  if (eventAccountId !== currentActiveAccountId && ['collecting', 'collect-stats', 'progress', 'collect-done', 'stopped'].includes(data.type)) {
    renderAccountsPanel();
    updateAccountSummary();
    return;
  }
  if (!isCollecting && ['collecting', 'collect-stats', 'progress', 'collect-done'].includes(data.type)) return;

  switch (data.type) {
    case 'opened':
      if (eventAccountId === currentActiveAccountId) {
        setConnectStatus(`${getAccountLabel(eventAccountId)} открыт. Проверяем состояние...`, 'warn');
      }
      void checkStatus(eventAccountId);
      break;

    case 'connected':
      void checkStatus(eventAccountId);
      break;

    case 'timeout': {
      if (eventAccountId === currentActiveAccountId) {
        setConnectStatus('Обновляем статус WhatsApp...', 'warn');
      }
      const btn = getEl('btnOpenWA');
      if (btn) {
        btn.disabled = false;
        btn.dataset.state = 'idle';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Подключить`;
      }
      void checkStatus(eventAccountId);
      break;
    }

    case 'collecting':
      setStatus('collectStatus', data.message, 'warn');
      if (data.stats) renderCollectStats(data.stats);
      setCollectState('Сбор...', 'progress');
      break;

    case 'collect-stats': {
      const s = data.stats || {};
      collectSessionCurrent = Number(s.added || collectSessionCurrent || 0);
      collectSessionTarget = Number(s.targetCount || collectSessionTarget || getNumericInputValue('collectTargetCount', 0));
      renderCollectStats(s);
      updateCollectProgress(collectSessionCurrent, collectSessionTarget);
      setCollectState('Сбор...', 'progress');
      break;
    }

    // Realtime: one new contact arrived
    case 'progress': {
      if (data.contact) {
        const c = data.contact;
        if (appendContactIfNew(c)) {
          baseUnsaved = true;
        }
        collectSessionCurrent = Math.max(collectSessionCurrent, Number(data.current || data.total || 0));
        collectSessionTarget = Math.max(
          collectSessionTarget,
          Number(data.target || collectSessionTarget || getNumericInputValue('collectTargetCount', 0))
        );
        setStatus('collectStatus',
          `Найден: ${c.name} (${data.total})`,
          'warn');
        updateCollectProgress(collectSessionCurrent, collectSessionTarget);
        if (data.stats) renderCollectStats(data.stats);
        setCollectState('Сбор...', 'progress');
      }
      break;
    }

    case 'collect-done': {
      const s = data.stats || {};
      collectSessionCurrent = Number(s.added || data.count || collectSessionCurrent || 0);
      collectSessionTarget = Number(s.targetCount || collectSessionTarget || getNumericInputValue('collectTargetCount', 0));
      const summary = [
        `Сбор завершён`,
        `было в базе: ${s.alreadyInBase || 0}`,
        `найдено: ${s.found || 0}`,
        `добавлено новых: ${s.added || data.count || 0}`,
        `пропущено дублей: ${s.skippedDuplicates || 0}`,
        `ошибок: ${s.errors || 0}`,
      ].join(' | ');
      setStatus('collectStatus', summary, 'ok');
      setCollectButtons(false);
      showToast(`Собрано ${formatCountRu(s.added || data.count || 0, RU_FORMS.contact)}`, 'ok');
      renderCollectStats(s);
      updateCollectProgress(collectSessionCurrent, collectSessionTarget);
      setCollectState('Готово', 'success');
      break;
    }

    case 'stopped':
      setStatus('collectStatus', `Остановлено. Добавлено в этой сессии: ${collectSessionCurrent}`, 'warn');
      setCollectButtons(false);
      showToast('Сбор остановлен', 'warn');
      updateCollectProgress(collectSessionCurrent, collectSessionTarget);
      setCollectState('Остановлено', 'warning');
      break;

    default:
      break;
  }
}

// ─── Collect Buttons State ────────────────────────────────────────
function setCollectButtons(collecting) {
  isCollecting = collecting;
  const btnCollect = getEl('btnCollect');
  const btnStop    = getEl('btnCollectStop');
  const baseSelect = getEl('contactBaseType');
  const countInput = getEl('collectTargetCount');
  const presetButtons = document.querySelectorAll('[data-collect-preset]');

  if (collecting) {
    if (btnCollect) {
      btnCollect.disabled = true;
      btnCollect.dataset.state = 'loading';
      btnCollect.innerHTML = `<span class="spin">⟳</span> Сбор...`;
    }
    if (btnStop) btnStop.disabled = false;
    if (baseSelect) baseSelect.disabled = true;
    if (countInput) countInput.disabled = true;
    presetButtons.forEach((button) => {
      button.disabled = true;
    });
    setCollectState('Сбор...', 'progress');
  } else {
    if (btnCollect) {
      btnCollect.disabled = false;
      btnCollect.dataset.state = 'idle';
      btnCollect.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg> Собрать`;
    }
    if (btnStop) btnStop.disabled = true;
    if (baseSelect) baseSelect.disabled = false;
    if (countInput) countInput.disabled = false;
    presetButtons.forEach((button) => {
      button.disabled = false;
    });
  }

  updateBaseActionButtons();
  renderAccountsPanel();
}

// ─── Collect Contacts ─────────────────────────────────────────────
async function collectContacts() {
  if (isCollecting) return;
  try {
    const hasAccounts = await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId,
      preferredSendAccount: currentSendAccountId,
      silent: true,
    });
    if (!hasAccounts) {
      setStatus('collectStatus', 'Нет доступных аккаунтов WhatsApp.', 'err');
      showToast('Нет доступных аккаунтов WhatsApp', 'err');
      return;
    }

    currentActiveAccountId = resolveAccountId(currentActiveAccountId);
    persistUiSetting(STORAGE_KEYS.activeAccount, currentActiveAccountId);

    const hasBases = await refreshBaseCatalog({ preferredCollectBase: getContactsBaseType(), silent: true });
    if (!hasBases) {
      setStatus('collectStatus', 'Создайте базу перед сбором контактов.', 'err');
      showToast('Нет доступных баз для сбора', 'err');
      return;
    }

    currentContactsBase = getContactsBaseType();
    currentContactsBase = resolveBaseId(currentContactsBase, currentSendBase);
    persistUiSetting(STORAGE_KEYS.collectTarget, String(getNumericInputValue('collectTargetCount', 50)));
    persistUiSetting(STORAGE_KEYS.contactsBase, currentContactsBase);

    const targetCount = Math.max(1, parseInt(getEl('collectTargetCount')?.value, 10) || 1);
    let previousContacts = contacts.slice();
    const loadInfo = await window.api.contactsLoadInfo(currentContactsBase);
    if (!loadInfo?.ok) throw new Error(loadInfo?.error || 'Не удалось загрузить выбранную базу');
    replaceContacts(loadInfo.contacts || []);
    testSelectedContacts = testSelectedContacts.filter((item) => contactPhoneSet.has(normalizePhoneKey(item?.phone)));
    renderContactList();
    baseUnsaved = false;
    syncBaseCount(currentContactsBase, contacts.length);
    previousContacts = contacts.slice();

    let mode = 'continue';

    if (contacts.length > 0) {
      mode = await showCollectConfirm();
      if (mode === 'cancel') return;
    }

    if (mode === 'reset') {
      const confirmedReset = await confirmCollectReset();
      if (!confirmedReset) return;
      replaceContacts([]);
      renderContactList();
      baseUnsaved = false;
      syncBaseCount(currentContactsBase, 0);
    }

    resetCollectSession(targetCount, mode);
    setCollectButtons(true);

    const statsEl = getEl('collectStats');
    if (statsEl) {
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';
    }

    setStatus(
      'collectStatus',
      `Сбор... Аккаунт «${getAccountLabel(currentActiveAccountId)}», база «${getBaseLabel(currentContactsBase)}», режим: ${mode === 'reset' ? 'новый сбор' : 'продолжить'}, цель новых контактов: ${targetCount}.`,
      'warn'
    );
    setCollectState('Сбор...', 'progress');

    const res = await window.api.waCollect(currentActiveAccountId, { targetCount, baseType: currentContactsBase, mode });

    if (res.ok) {
      replaceContacts(res.contacts || []);
      renderContactList();
      baseUnsaved = false;
      updateCollectProgress(collectSessionCurrent, collectSessionTarget);
      syncBaseCount(currentContactsBase, contacts.length);
      if (res.loadStats) {
        const found = Number(res.loadStats.found || 0);
        const added = Number(res.loadStats.added || 0);
        const skipped = Number(res.loadStats.skippedDuplicates || 0);
        const errors = Number(res.loadStats.errors || 0);
        const removed = Number(res.loadStats.removedDuplicates || 0);
        const finalCount = Number(res.loadStats.final ?? contacts.length);
        const alreadyInBase = Number(res.loadStats.alreadyInBase || 0);
        renderCollectStats(res.loadStats);
        setStatus(
          'collectStatus',
          `${res.stopped ? 'Сбор остановлен' : 'Сбор завершён'}. Было в базе: ${alreadyInBase}, найдено в WhatsApp: ${found}, добавлено новых: ${added}, пропущено дублей: ${skipped}, ошибок: ${errors}. Удалено дублей: ${removed}, итог: ${finalCount}.`,
          res.stopped || removed > 0 || skipped > 0 ? 'warn' : 'ok'
        );
      }
      await refreshBaseCatalog({
        preferredCollectBase: currentContactsBase,
        preferredSendBase: currentSendBase,
        silent: true,
      });
      setCollectButtons(false);
      setCollectState(res.stopped ? 'Остановлено' : 'Готово', res.stopped ? 'warning' : 'success');
    } else {
      if (mode === 'reset') {
        replaceContacts(previousContacts);
        renderContactList();
        syncBaseCount(currentContactsBase, contacts.length);
      }
      setStatus('collectStatus', 'Ошибка: ' + res.error, 'err');
      showToast('Сбор завершился с ошибкой', 'err');
      setCollectButtons(false);
      setCollectState('Ошибка', 'error');
    }
  } catch (error) {
    if (activeCollectMode === 'reset') {
      await loadContactsBaseNew(currentContactsBase, { silent: true, refreshCatalog: false });
    }
    reportError('Сбор контактов завершился с ошибкой', error, { statusId: 'collectStatus' });
    setCollectButtons(false);
    setCollectState('Ошибка', 'error');
  }
}

// Dialog: "База уже есть — что делать?"
function showCollectConfirm() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    };
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">Продолжить сбор?</div>
        <div class="modal-body">База «${escHtml(getBaseLabel(currentContactsBase))}» уже содержит ${formatCountRu(contacts.length, RU_FORMS.contact)}. Можно собрать дальше без дублей или начать заново.</div>
        <div class="modal-btns">
          <button class="btn btn-primary btn-sm" id="mContinue">Продолжить сбор</button>
          <button class="btn btn-ghost btn-sm" id="mReset">Начать заново</button>
          <button class="btn btn-danger btn-sm" id="mCancel">Отмена</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const continueBtn = overlay.querySelector('#mContinue');
    const resetBtn = overlay.querySelector('#mReset');
    const cancelBtn = overlay.querySelector('#mCancel');
    if (continueBtn) continueBtn.onclick = () => finish('continue');
    if (resetBtn) resetBtn.onclick = () => finish('reset');
    if (cancelBtn) cancelBtn.onclick = () => finish('cancel');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish('cancel');
    });
  });
}

function confirmCollectReset() {
  return showConfirmDialog({
    title: 'Начать сбор заново?',
    body: `База «${escHtml(getBaseLabel(currentContactsBase))}» будет очищена перед сбором. Это действие затронет только выбранную базу.`,
    confirmText: 'Начать заново',
    cancelText: 'Отмена',
    tone: 'danger',
  });
}

async function stopCollect() {
  if (!isCollecting) return;
  try {
    await window.api.waCollectStop(currentActiveAccountId);
    setStatus('collectStatus', 'Остановка...', 'warn');
  } catch (error) {
    reportError('Не удалось остановить сбор', error, { statusId: 'collectStatus' });
  }
}

// ─── Contact List Rendering ────────────────────────────────────────
function getContactSearchTerm() {
  return String(getEl('contactSearch')?.value || '').trim();
}

function getContactSearchState() {
  const raw = getContactSearchTerm();
  const phoneQuery = normalizePhoneKey(raw);
  return {
    raw,
    query: raw.toLocaleLowerCase('ru-RU'),
    phoneQuery,
    relaxedPhoneQuery: phoneQuery.startsWith('0') ? phoneQuery.slice(1) : phoneQuery,
  };
}

function getFilteredContactIndices(force = false) {
  const { query, phoneQuery, relaxedPhoneQuery } = getContactSearchState();
  const cacheKey = `${query}|${phoneQuery}|${relaxedPhoneQuery}|${contacts.length}`;
  if (!force && cacheKey === contactFilterCacheKey) return filteredContactIndices;

  if (!query) {
    filteredContactIndices = contacts.map((_, index) => index);
    contactFilterCacheKey = cacheKey;
    return filteredContactIndices;
  }

  const nextIndices = [];
  for (let index = 0; index < contacts.length; index += 1) {
    const entry = contactSearchIndex[index] || buildContactSearchEntry(contacts[index]);
    if (
      entry.nameLower.includes(query)
      || entry.phoneLower.includes(query)
      || (phoneQuery && entry.phoneKey.includes(phoneQuery))
      || (relaxedPhoneQuery && relaxedPhoneQuery !== phoneQuery && entry.phoneKey.includes(relaxedPhoneQuery))
    ) {
      nextIndices.push(index);
    }
  }

  filteredContactIndices = nextIndices;
  contactFilterCacheKey = cacheKey;
  return filteredContactIndices;
}

function getVisibleContactEntries(force = false) {
  return getFilteredContactIndices(force).map((index) => ({ contact: contacts[index], index }));
}

function isContactSelectedForTest(contact) {
  const key = normalizePhoneKey(contact?.phone);
  return Boolean(key && testSelectedContacts.some((item) => normalizePhoneKey(item?.phone) === key));
}

function highlightContactText(value, rawQuery, normalizedQuery = rawQuery.toLocaleLowerCase('ru-RU')) {
  const source = String(value || '');
  if (!source || !rawQuery) return escHtml(source);

  const lowerSource = source.toLocaleLowerCase('ru-RU');
  const matchIndex = lowerSource.indexOf(normalizedQuery);
  if (matchIndex === -1) return escHtml(source);

  const endIndex = matchIndex + rawQuery.length;
  return `${escHtml(source.slice(0, matchIndex))}<mark class="contact-highlight">${escHtml(source.slice(matchIndex, endIndex))}</mark>${escHtml(source.slice(endIndex))}`;
}

function renderContactItem(c, i, searchState = getContactSearchState()) {
  const selectedForTest = isContactSelectedForTest(c);
  const displayName = c?.name || 'Без имени';
  return `
    <div class="contact-item" id="contact-${i}">
      <div class="contact-main">
        <div class="contact-avatar">
          ${escHtml((displayName || c.phone || '?').charAt(0).toUpperCase())}
        </div>
        <div class="contact-info">
          <div class="contact-name" title="${escHtml(displayName)}">${highlightContactText(displayName, searchState.raw, searchState.query)}</div>
          <div class="contact-phone">${highlightContactText(c.phone, searchState.raw, searchState.query)}</div>
        </div>
      </div>
      <div class="contact-actions">
        <button class="contact-action-btn ${selectedForTest ? 'is-active' : ''}" onclick="addContactToTest(${i})" title="${selectedForTest ? 'Уже выбран для теста' : 'Добавить в тестовую отправку'}">
          В тест
        </button>
        <button class="contact-action-btn contact-action-btn-danger" onclick="removeContact(${i})" title="Удалить контакт">
          Удалить
        </button>
      </div>
    </div>
  `;
}

function getContactRowHeight() {
  return window.innerWidth <= 980 ? CONTACT_ROW_HEIGHT_COMPACT : CONTACT_ROW_HEIGHT;
}

function getContactEmptyStateMarkup(message) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21"></path>
      <circle cx="9" cy="7" r="4"></circle>
    </svg>
    <p>${escHtml(message)}</p>
  </div>`;
}

function renderVisibleContactViewport({ syncDashboard = true } = {}) {
  const list = getEl('contactList');
  const viewport = getEl('contactListViewport');
  const spacer = getEl('contactListSpacer');
  if (!list || !viewport || !spacer) return;

  updateContactCountLabel({ syncDashboard });
  const visibleIndices = getFilteredContactIndices();

  if (!contacts.length) {
    list.classList.add('is-empty');
    spacer.style.height = '0px';
    viewport.style.transform = 'translateY(0)';
    viewport.innerHTML = getContactEmptyStateMarkup('База пока пустая. Соберите или импортируйте контакты.');
    return;
  }

  if (!visibleIndices.length) {
    list.classList.add('is-empty');
    spacer.style.height = '0px';
    viewport.style.transform = 'translateY(0)';
    viewport.innerHTML = getContactEmptyStateMarkup('Контакт не найден. Проверьте номер или имя.');
    return;
  }

  list.classList.remove('is-empty');

  const rowHeight = getContactRowHeight();
  const scrollTop = list.scrollTop;
  const viewportHeight = Math.max(list.clientHeight, rowHeight * 4);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - CONTACT_VIEW_OVERSCAN);
  const endIndex = Math.min(
    visibleIndices.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + CONTACT_VIEW_OVERSCAN,
    startIndex + 150
  );
  const searchState = getContactSearchState();

  spacer.style.height = `${visibleIndices.length * rowHeight}px`;
  viewport.style.transform = `translateY(${startIndex * rowHeight}px)`;
  viewport.innerHTML = visibleIndices
    .slice(startIndex, endIndex)
    .map((index) => renderContactItem(contacts[index], index, searchState))
    .join('');
}

function renderContactList({ resetScroll = false, syncDashboard = true } = {}) {
  const list = getEl('contactList');
  if (!list) return;
  if (resetScroll) list.scrollTop = 0;

  if (contactViewportFrame) cancelAnimationFrame(contactViewportFrame);
  contactViewportFrame = requestAnimationFrame(() => {
    contactViewportFrame = 0;
    renderVisibleContactViewport({ syncDashboard });
  });
}

function appendContactToList() {
  contactFilterCacheKey = '';
  renderContactList();
}

function renderCollectStats(s) {
  const el = getEl('collectStats');
  if (!el || !s) return;
  el.style.display = 'grid';
  const alreadyInBase = Number(s.alreadyInBase || 0);
  const found = Number(s.found || 0);
  const added = Number(s.added || 0);
  const skipped = Number(s.skippedDuplicates || s.skipped || 0);
  const errors = Number(s.errors || 0);
  const target = Number(s.targetCount || collectSessionTarget || getNumericInputValue('collectTargetCount', 0));
  el.innerHTML = `
    <div class="mini-stat"><span>${alreadyInBase}</span>Было в базе</div>
    <div class="mini-stat info"><span>${found}</span>Найдено в WhatsApp</div>
    <div class="mini-stat ok"><span>${added}</span>Добавлено новых</div>
    <div class="mini-stat warn"><span>${skipped}</span>Пропущено дублей</div>
    <div class="mini-stat"><span>${errors}</span>Ошибок</div>
    <div class="mini-stat"><span>${target}</span>Цель новых</div>`;
}

// ─── Contact Actions ─────────────────────────────────────────────
async function removeContact(i) {
  if (typeof i !== 'number' || i < 0 || i >= contacts.length) return;
  const contact = contacts[i];
  const confirmed = await showConfirmDialog({
    title: 'Удалить контакт?',
    body: `Удалить контакт «${escHtml(contact.name || contact.phone)}»? Он будет удалён из активной базы.`,
    confirmText: 'Удалить',
    tone: 'danger',
  });
  if (!confirmed) return;

  contacts.splice(i, 1);
  syncContactPhoneSet();
  testSelectedContacts = testSelectedContacts.filter((item) => normalizePhoneKey(item?.phone) !== normalizePhoneKey(contact?.phone));
  renderContactList();
  void persistCurrentContacts();
  baseUnsaved = false;
}

function addContactToTest(i) {
  if (typeof i !== 'number' || i < 0 || i >= contacts.length) return;
  const contact = contacts[i];
  const key = normalizePhoneKey(contact?.phone);
  if (!key) return;

  if (testSelectedContacts.some((item) => normalizePhoneKey(item?.phone) === key)) {
    showToast('Контакт уже выбран для теста', 'warn');
    return;
  }

  if (testSelectedContacts.length >= 5) {
    showToast('Для теста можно выбрать до 5 контактов из базы', 'warn');
    return;
  }

  testSelectedContacts.push(contact);
  renderContactList();
  showToast(`Добавлен в тест: ${contact.phone}`, 'ok');
}

async function removeDuplicates() {
  if (!currentContactsBase) {
    showToast('Выберите базу контактов', 'err');
    return;
  }
  try {
    const result = await window.api.contactsDedupe?.(currentContactsBase);
    if (!result?.ok) throw new Error(result?.error || 'Не удалось убрать дубли');
    const loadInfo = await window.api.contactsLoadInfo(currentContactsBase);
    if (!loadInfo?.ok) throw new Error(loadInfo?.error || 'Не удалось перечитать базу после удаления дублей');
    replaceContacts(loadInfo.contacts || []);
    testSelectedContacts = testSelectedContacts.filter((item) => contactPhoneSet.has(normalizePhoneKey(item?.phone)));
    renderContactList({ resetScroll: true });
    baseUnsaved = false;
    syncBaseCount(currentContactsBase, contacts.length);
    const removed = Number(result.removedDuplicates || 0);
    const removedByPhone = Number(result.removedByPhone || 0);
    const removedByName = Number(result.removedByName || 0);
    const before = Number(result.totalBefore || result.total || 0);
    const finalCount = Number(loadInfo.final || loadInfo.totalAfter || contacts.length);
    const message = removed > 0
      ? `Дубли удалены. Было: ${before}, стало: ${finalCount}, по номеру: ${removedByPhone}, по имени: ${removedByName}.`
      : 'Дубли не найдены.';
    setStatus('collectStatus', message, removed > 0 ? 'ok' : 'warn');
    showToast(message, removed > 0 ? 'ok' : 'warn');
  } catch (error) {
    reportError('Не удалось убрать дубли', error, { statusId: 'collectStatus' });
  }
}

async function clearContacts() {
  const confirmed = await showConfirmDialog({
    title: 'Очистить базу?',
    body: `Очистить базу «${escHtml(getBaseLabel(currentContactsBase))}»? Будут удалены ${formatCountRu(contacts.length, RU_FORMS.contact)}.`,
    confirmText: 'Очистить',
    tone: 'danger',
  });
  if (!confirmed) return;
  replaceContacts([]);
  testSelectedContacts = [];
  renderContactList();
  void persistCurrentContacts();
  baseUnsaved = false;
  showToast('База очищена', 'warn');
}

// ─── Save / Export / Import ─────────────────────────────────────
async function exportCsv() {
  if (!contacts.length) { showToast('База пуста', 'err'); return; }
  try {
    const res = await window.api.contactsExportCsv({
      contacts,
      baseId: currentContactsBase,
      baseName: getBaseLabel(currentContactsBase),
    });
    if (res?.ok) showToast('CSV сохранён', 'ok');
    if (res?.error) throw new Error(res.error);
  } catch (error) {
    reportError('Не удалось экспортировать CSV', error, { statusId: 'collectStatus' });
  }
}

async function exportJson() {
  if (!contacts.length) { showToast('База пуста', 'err'); return; }
  try {
    const res = await window.api.contactsExportJson({
      contacts,
      baseId: currentContactsBase,
      baseName: getBaseLabel(currentContactsBase),
    });
    if (res?.ok) showToast('JSON сохранён', 'ok');
    if (res?.error) throw new Error(res.error);
  } catch (error) {
    reportError('Не удалось экспортировать JSON', error, { statusId: 'collectStatus' });
  }
}

async function importCsv() {
  try {
    const res = await window.api.contactsImportCsv();
    if (!res || !res.ok) {
      if (res?.error) showToast('Ошибка импорта: ' + res.error, 'err');
      return;
    }

    const importTarget = await showImportConfirm(res);
    if (!importTarget) return;

    const result = await window.api.contactsImportConfirm({
      importId: res.importId,
      ...importTarget,
    });

    if (!result?.ok) throw new Error(result?.error || 'Не удалось завершить импорт');

    await refreshBaseCatalog({
      preferredCollectBase: result.base.id,
      preferredSendBase: result.base.id,
      silent: true,
    });
    await loadContactsBaseNew(result.base.id, { silent: true, refreshCatalog: false });
    currentContactsBase = result.base.id;
    persistUiSetting(STORAGE_KEYS.contactsBase, currentContactsBase);
    baseUnsaved = false;
    const importedCount = Number(result.imported || 0);
    const duplicateCount = Number(result.skippedDuplicates ?? result.duplicates ?? 0);
    const finalCount = Number(result.final ?? contacts.length);
    const addedCount = Number(result.addedNew ?? importedCount);
    setStatus(
      'collectStatus',
      `Импортировано: ${importedCount}. Добавлено новых: ${addedCount}. Удалено дублей: ${duplicateCount}. Итого в базе: ${finalCount}.`,
      duplicateCount > 0 ? 'warn' : 'ok'
    );
    showToast(`Добавлено новых: ${addedCount}. Пропущено дублей: ${duplicateCount}.`, duplicateCount > 0 ? 'warn' : 'ok');
  } catch (error) {
    reportError('Не удалось импортировать контакты', error, { statusId: 'collectStatus' });
  }
}

function showImportConfirm(importInfo) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    let settled = false;
    const finish = (value = '') => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    };

    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">Импорт базы</div>
        <div class="modal-body">
          <div class="import-summary">
            <div><span>Файл</span><strong title="${escHtml(importInfo.fileName)}">${escHtml(importInfo.fileName)}</strong></div>
            <div><span>Контактов найдено</span><strong>${Number(importInfo.found || importInfo.imported || 0)}</strong></div>
            <div><span>Дубли</span><strong>${Number(importInfo.duplicates || 0)}</strong></div>
          </div>
          ${currentContactsBase ? `
            <label class="modal-check">
              <input type="checkbox" id="importToCurrent">
              <span>Добавить в текущую базу «${escHtml(getBaseLabel(currentContactsBase))}»</span>
            </label>
          ` : ''}
          <label for="importBaseName">Название новой базы</label>
          <input type="text" id="importBaseName" value="${escHtml(importInfo.suggestedName || '')}" maxlength="80">
          <div class="field-error" id="importBaseNameError"></div>
        </div>
        <div class="modal-btns">
          <button class="btn btn-primary btn-sm" id="importConfirm">Импортировать</button>
          <button class="btn btn-ghost btn-sm" id="importCancel">Отмена</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#importBaseName');
    const importToCurrent = overlay.querySelector('#importToCurrent');
    const errorEl = overlay.querySelector('#importBaseNameError');
    const showError = (message) => {
      input?.classList.add('is-invalid');
      if (errorEl) errorEl.textContent = message;
    };
    const clearError = () => {
      input?.classList.remove('is-invalid');
      if (errorEl) errorEl.textContent = '';
    };
    const submit = () => {
      if (importToCurrent?.checked && currentContactsBase) {
        finish({ baseId: currentContactsBase });
        return;
      }
      const validation = validateNameInput(input?.value || '', bases, {
        emptyMessage: 'Введите название базы',
        duplicateMessage: 'База с таким названием уже есть',
      });
      if (!validation.ok) {
        showError(validation.error);
        return;
      }
      finish({ baseName: validation.name });
    };

    importToCurrent?.addEventListener('change', () => {
      if (input) input.disabled = importToCurrent.checked;
      clearError();
    });
    input?.addEventListener('input', clearError);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
    });
    input?.focus();
    input?.select();
    overlay.querySelector('#importConfirm')?.addEventListener('click', submit);
    overlay.querySelector('#importCancel')?.addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(null);
    });
  });
}

// ─── AI helper ────────────────────────────────────────────────────
function renderAiConnectionState() {
  getEl('aiConnectCard')?.classList.toggle('is-hidden', aiConnected);
  getEl('aiWorkspace')?.classList.toggle('is-hidden', !aiConnected);
}

function getAiErrorMessage(errorCode) {
  switch (String(errorCode || '')) {
    case 'network':
      return 'Нет интернета. Проверьте подключение и попробуйте ещё раз.';
    case 'invalid-key':
      return 'Неверный API ключ. Проверьте ключ OpenRouter.';
    case 'rate-limit':
      return 'Превышен лимит запросов. Попробуйте позже.';
    case 'OPENROUTER_API_KEY is not configured':
      return 'Подключите ИИ через API ключ.';
    default:
      return 'Не удалось подключить ИИ';
  }
}

function getBillzErrorMessage(errorCode) {
  switch (String(errorCode || '')) {
    case 'network':
      return 'Нет интернета или BILLZ временно недоступен';
    case 'rate-limit':
      return 'Слишком много запросов. Попробуйте позже';
    case 'missing-secret':
      return 'Введите Secret ключ BILLZ';
    case 'no-access':
      return 'Нет доступа к BILLZ данным';
    case 'auth-error':
    default:
      return 'Ошибка авторизации';
  }
}

function renderBillzState(status = {}) {
  const card = getEl('billzCard');
  const summary = getEl('billzSummaryText');
  const statusLine = getEl('billzStatusLine');
  const apiBaseUrlInput = getEl('billzApiBaseUrlInput');
  const panel = getEl('billzPanel');
  const button = document.querySelector('.billz-summary');
  const normalized = status.status || (status.connected ? 'connected' : billzState);
  billzState = ['connected', 'checking', 'error', 'disconnected'].includes(normalized) ? normalized : 'disconnected';
  billzHasSavedKey = Boolean(status.hasKey || status.maskedSecret);

  if (card) card.dataset.state = billzState;
  if (panel) panel.classList.toggle('is-hidden', !billzExpanded);
  if (button) button.setAttribute('aria-expanded', billzExpanded ? 'true' : 'false');

  const labels = {
    connected: 'BILLZ ● подключен',
    checking: 'BILLZ ● проверка',
    error: 'BILLZ ⚠ ошибка',
    disconnected: 'BILLZ ○ не подключен',
  };
  if (summary) summary.textContent = labels[billzState] || labels.disconnected;

  if (statusLine) {
    if (billzState === 'connected') statusLine.textContent = 'подключен';
    else if (billzState === 'checking') statusLine.textContent = 'проверка';
    else if (billzState === 'error') statusLine.textContent = getBillzErrorMessage(status.error);
    else if (status.maskedSecret) statusLine.textContent = `${billzState === 'connected' ? 'connected' : 'key saved'} · ${status.maskedSecret}`;
    else statusLine.textContent = 'не подключен';
  }

  if (apiBaseUrlInput && status.apiBaseUrl && document.activeElement !== apiBaseUrlInput) {
    apiBaseUrlInput.value = status.apiBaseUrl;
  }
}

async function loadBillzStatus() {
  try {
    const status = await window.api.billzConfigStatus?.();
    renderBillzState(status || {});
  } catch {
    renderBillzState({ status: 'disconnected' });
  }
}

function toggleBillzPanel() {
  billzExpanded = !billzExpanded;
  renderBillzState({ status: billzState });
  if (billzExpanded) setTimeout(() => getEl('billzSecretInput')?.focus(), 50);
}


function renderBillzDiagnostics(diagnostics = {}) {
  const box = getEl('billzDiagnostics');
  if (!box) return;
  const endpoints = Array.isArray(diagnostics.endpoints) ? diagnostics.endpoints : [];
  billzDiagnosticSamples.clear();
  if (!endpoints.length) {
    box.innerHTML = '';
    return;
  }

  const rows = endpoints.map((item, index) => {
    if (item.sample) billzDiagnosticSamples.set(String(index), item.sample);
    const paramsText = item.params === undefined || item.params === null ? '{}' : JSON.stringify(item.params);
    const fields = item.sampleFields && typeof item.sampleFields === 'object'
      ? Object.entries(item.sampleFields).map(([key, value]) => `${escHtml(key)}: ${escHtml(String(value).slice(0, 80))}`).join(', ')
      : '';
    const errorText = item.errorMessage ? escHtml(item.errorMessage) : '';
    const errorCode = item.errorCode ? `<div class="billz-error-message">code: ${escHtml(String(item.errorCode))}</div>` : '';
    const errorData = item.errorData !== undefined && item.errorData !== null
      ? `<pre class="billz-error-data">${escHtml(JSON.stringify(item.errorData, null, 2))}</pre>`
      : '';
    const countText = Number(item.count || 0) > 0 ? ` · ${Number(item.count || 0)} items` : '';
    const copyButton = item.sample
      ? `<button class="btn btn-secondary btn-sm" type="button" onclick="copyBillzSample('${index}')">Copy sample JSON</button>`
      : '';
    return `
      <tr>
        <td>${escHtml(item.method || item.endpoint || '')}</td>
        <td><code>${escHtml(paramsText)}</code></td>
        <td>${escHtml(String(item.status || ''))}</td>
        <td>${escHtml(String(item.count || 0))}</td>
        <td>
          <div>${escHtml(item.result || item.code || '')}${countText}</div>
          ${errorCode}
          ${errorText ? `<div class="billz-error-message">${errorText}</div>` : ''}
          ${errorData}
          ${fields ? `<div class="billz-sample-fields">${fields}</div>` : ''}
          ${copyButton}
        </td>
      </tr>`;
  }).join('');

  box.innerHTML = `
    <table class="billz-diagnostics-table">
      <thead><tr><th>Method</th><th>Params</th><th>Status</th><th>Count</th><th>Result</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function copyBillzSample(id) {
  const sample = billzDiagnosticSamples.get(String(id));
  if (!sample) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(sample, null, 2));
    showToast('Sample JSON copied', 'ok');
  } catch {
    showToast('Could not copy sample JSON', 'err');
  }
}

function renderBillzSearchResults(result = {}) {
  const box = getEl('billzSearchResults');
  if (!box) return;
  const products = Array.isArray(result.products) ? result.products : [];
  if (!result.ok) {
    const errorData = result.errorData !== undefined && result.errorData !== null
      ? `<pre class="billz-error-data">${escHtml(JSON.stringify(result.errorData, null, 2))}</pre>`
      : '';
    box.innerHTML = `
      <div class="billz-error-message">${escHtml(result.errorMessage || getBillzErrorMessage(result.error) || 'BILLZ search failed')}</div>
      ${errorData}`;
    return;
  }
  if (!products.length) {
    box.innerHTML = '<div class="billz-sample-fields">No products found</div>';
    return;
  }

  const rows = products.map((item) => {
    const shops = Array.isArray(item.shops)
      ? item.shops.map((shop) => {
          const stock = shop.stock === null || shop.stock === undefined ? '' : `stock ${shop.stock}`;
          const price = shop.price === null || shop.price === undefined ? '' : `${shop.price} ${shop.currency || ''}`.trim();
          return [shop.shopName || shop.shopId || '', stock, price].filter(Boolean).join(' / ');
        }).slice(0, 3).join('; ')
      : '';
    const attrs = [item.size && `size ${item.size}`, item.color && `color ${item.color}`, item.model && `model ${item.model}`]
      .filter(Boolean)
      .join(', ');
    return `
      <tr>
        <td>${escHtml(item.name || '')}</td>
        <td>${escHtml(item.sku || item.vendorCode || '')}</td>
        <td>${escHtml(item.barcode || '')}</td>
        <td>${escHtml(String(item.promoPrice || item.price || ''))} ${escHtml(item.currency || '')}</td>
        <td>${escHtml(String(item.stock ?? ''))}</td>
        <td>${escHtml(shops || item.office || item.officeName || '')}</td>
        <td>${escHtml(attrs)}</td>
      </tr>`;
  }).join('');

  box.innerHTML = `
    <table class="billz-diagnostics-table">
      <thead><tr><th>Name</th><th>SKU</th><th>Barcode</th><th>Price</th><th>Stock</th><th>Office/store</th><th>Size/color/model</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderAiBillzContextDebug(context = null) {
  const box = getEl('aiBillzContextDebug');
  if (!box) return;
  if (!context) {
    box.innerHTML = '';
    return;
  }
  const products = Array.isArray(context.products) ? context.products : [];
  const firstProduct = products[0] || null;
  const firstHumanized = Array.isArray(context.humanized?.products) ? context.humanized.products[0] : null;
  const colorDebug = firstHumanized?.colorDebug || null;
  const storeDebug = firstHumanized?.storeDebug || null;
  box.innerHTML = `
    <details class="billz-context-debug">
      <summary>BILLZ context</summary>
      <div class="billz-sample-fields">connected: ${escHtml(String(Boolean(context.connected)))}</div>
      <div class="billz-sample-fields">products.length: ${escHtml(String(products.length))}</div>
      <div class="billz-sample-fields">detectedIntent: ${escHtml(String(context.detectedIntent || 'unknown'))}</div>
      <div class="billz-sample-fields">totalCachedProducts: ${escHtml(String(context.totalCachedProducts ?? 0))}</div>
      <div class="billz-sample-fields">matchedProducts: ${escHtml(String(context.matchedProducts ?? products.length))}</div>
      <div class="billz-sample-fields">searchMode: ${escHtml(String(context.searchMode || ''))}</div>
      ${context.parsedQuery ? `<pre class="billz-error-data">${escHtml(JSON.stringify({ parsedQuery: context.parsedQuery }, null, 2))}</pre>` : ''}
      ${context.sizeRecommendation ? `<pre class="billz-error-data">${escHtml(JSON.stringify({ sizeRecommendation: context.sizeRecommendation }, null, 2))}</pre>` : ''}
      ${context.searchDebug ? `<pre class="billz-error-data">${escHtml(JSON.stringify(context.searchDebug, null, 2))}</pre>` : ''}
      ${context.brandSummary ? `<pre class="billz-error-data">${escHtml(JSON.stringify({ brandSummary: context.brandSummary }, null, 2))}</pre>` : ''}
      ${colorDebug ? `<pre class="billz-error-data">${escHtml(JSON.stringify(colorDebug, null, 2))}</pre>` : ''}
      ${storeDebug ? `<pre class="billz-error-data">${escHtml(JSON.stringify(storeDebug, null, 2))}</pre>` : ''}
      ${context.humanized ? `<pre class="billz-error-data">${escHtml(JSON.stringify({ humanized: context.humanized }, null, 2))}</pre>` : ''}
      ${firstProduct ? `<pre class="billz-error-data">${escHtml(JSON.stringify(firstProduct, null, 2))}</pre>` : ''}
    </details>`;
}

function renderAiSandboxThread() {
  const box = getEl('aiSandboxThread');
  if (!box) return;
  box.innerHTML = aiSandboxMessages.map((message) => `
    <div class="ai-sandbox-message ai-sandbox-${escHtml(message.role)}">
      <div>${escHtml(message.content)}</div>
      <span>${escHtml(message.time || '')}</span>
    </div>
  `).join('');
  box.scrollTop = box.scrollHeight;
}

async function clearAiSandbox() {
  aiSandboxMessages = [];
  renderAiSandboxThread();
  renderAiBillzContextDebug(null);
  setText('aiTestAnswer', 'Диалог очищен.');
  try {
    await window.api.aiTestChat?.({ text: 'reset', reset: true });
  } catch {}
}

async function saveBillzSecret() {
  const input = getEl('billzSecretInput');
  const apiBaseUrlInput = getEl('billzApiBaseUrlInput');
  const button = getEl('btnBillzSave');
  const secretToken = String(input?.value || '').trim();
  const apiBaseUrl = String(apiBaseUrlInput?.value || '').trim();
  if (!secretToken && !billzHasSavedKey) {
    renderBillzState({ status: 'error', error: 'missing-secret' });
    input?.focus();
    return;
  }

  if (button) button.disabled = true;
  if (button) button.textContent = 'Saving...';
  try {
    const result = await (window.api.billzConfigSaveSecret || window.api.billzConfigSaveKey)?.({ secretToken, apiBaseUrl });
    if (!result?.ok) throw new Error(result?.error || 'auth-error');
    if (input) input.value = '';
    renderBillzState(result);
    showToast('BILLZ key saved', 'ok');
  } catch (error) {
    const code = error?.message || 'auth-error';
    renderBillzState({ status: 'error', error: code });
    showToast(getBillzErrorMessage(code), 'err');
  } finally {
    if (button) button.disabled = false;
    if (button) button.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043a\u043b\u044e\u0447';
  }
}

async function checkBillzConnection() {
  const button = getEl('btnBillzCheck');
  renderBillzState({ status: 'checking' });
  if (button) button.disabled = true;
  if (button) button.textContent = 'Checking...';
  try {
    const result = await window.api.billzCheckConnection?.();
    renderBillzState(result || {});
    if (!result?.ok) throw new Error(result?.error || 'auth-error');
    showToast('BILLZ connected', 'ok');
  } catch (error) {
    const code = error?.message || 'auth-error';
    renderBillzState({ status: 'error', error: code });
    showToast(getBillzErrorMessage(code), 'err');
  } finally {
    if (button) button.disabled = false;
    if (button) button.textContent = '\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435';
  }
}

async function runBillzDiagnostics() {
  const button = getEl('btnBillzDiagnostics');
  renderBillzState({ status: 'checking' });
  renderBillzDiagnostics();
  if (button) button.disabled = true;
  if (button) button.textContent = 'Running...';
  try {
    const result = await window.api.billzRunDiagnostics?.();
    renderBillzState(result || {});
    if (result?.diagnostics) renderBillzDiagnostics(result.diagnostics);
    if (!result?.ok) throw new Error(result?.error || 'auth-error');
    showToast('BILLZ diagnostics complete', 'ok');
  } catch (error) {
    const code = error?.message || 'auth-error';
    renderBillzState({ status: 'error', error: code });
    showToast(getBillzErrorMessage(code), 'err');
  } finally {
    if (button) button.disabled = false;
    if (button) button.textContent = '\u0414\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430 API';
  }
}

async function connectBillzSecret() {
  return checkBillzConnection();
}

async function searchBillzProducts() {
  const input = getEl('billzProductSearchInput');
  const button = getEl('btnBillzSearch');
  const query = String(input?.value || '').trim();
  if (button) button.disabled = true;
  if (button) button.textContent = 'Searching...';
  renderBillzSearchResults({ ok: true, products: [] });
  try {
    const result = await window.api.billzSearchProducts?.({ query, limit: 5 });
    renderBillzSearchResults(result || {});
    if (!result?.ok) throw new Error(result?.error || 'unknown');
  } catch (error) {
    const code = error?.message || 'unknown';
    renderBillzSearchResults({ ok: false, error: code, errorMessage: getBillzErrorMessage(code) });
  } finally {
    if (button) button.disabled = false;
    if (button) button.textContent = 'Search';
  }
}

async function sendAiTest() {
  if (aiTestIsSending) return;
  const input = getEl('aiTestInput');
  const button = getEl('btnAiTestSend');
  const answer = getEl('aiTestAnswer');
  const text = String(input?.value || '').trim();
  if (!text) {
    if (answer) answer.textContent = 'Введите вопрос для проверки ИИ.';
    input?.focus();
    return;
  }

  aiTestIsSending = true;
  aiSandboxMessages.push({ role: 'user', content: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  renderAiSandboxThread();
  renderAiBillzContextDebug(null);
  if (button) button.disabled = true;
  if (button) button.textContent = 'Отправка...';
  if (answer) answer.textContent = 'ИИ думает...';

  try {
    const result = await window.api.aiTestChat?.({ text });
    if (!result?.ok) throw new Error(result?.error || 'unknown');
    renderAiBillzContextDebug(result.billzContext || null);
    aiSandboxMessages.push({ role: 'assistant', content: result.text || 'ИИ вернул пустой ответ.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    renderAiSandboxThread();
    if (input) input.value = '';
    if (answer) answer.textContent = result.text || 'ИИ вернул пустой ответ.';
  } catch (error) {
    if (answer) answer.textContent = getAiErrorMessage(error?.message);
  } finally {
    aiTestIsSending = false;
    if (button) button.disabled = false;
    if (button) button.textContent = 'Отправить';
  }
}

async function loadAiConfigStatus() {
  try {
    const status = await window.api.aiConfigStatus?.();
    aiConnected = Boolean(status?.connected);
    renderAiConnectionState();
  } catch {
    aiConnected = false;
    renderAiConnectionState();
  }
}

function showAiKeySetup() {
  aiConnected = false;
  aiResults = [];
  aiAddedVariantKeys.clear();
  renderAiResults();
  renderAiConnectionState();
  setTimeout(() => getEl('aiApiKeyInput')?.focus(), 50);
}

async function connectAiApiKey() {
  const input = getEl('aiApiKeyInput');
  const button = getEl('btnAiConnect');
  const key = String(input?.value || '').trim();
  if (!key) {
    showToast('Введите API ключ', 'err');
    input?.focus();
    return;
  }

  if (button) button.disabled = true;
  if (button) button.textContent = 'Проверяем...';
  try {
    const result = await window.api.aiConfigSaveKey?.({ key });
    if (!result?.ok) throw new Error(result?.error || 'invalid-key');
    aiConnected = true;
    if (input) input.value = '';
    renderAiConnectionState();
    showToast('ИИ подключён', 'ok');
  } catch (error) {
    showToast(getAiErrorMessage(error?.message), 'err');
  } finally {
    if (button) button.disabled = false;
    if (button) button.textContent = 'Подключить';
  }
}

function setAiMode(mode) {
  aiMode = mode === 'improve' ? 'improve' : 'create';
  aiResults = [];
  aiAddedVariantKeys.clear();

  getEl('aiModeCreate')?.classList.toggle('is-active', aiMode === 'create');
  getEl('aiModeImprove')?.classList.toggle('is-active', aiMode === 'improve');
  getEl('aiCreateInput')?.classList.toggle('is-hidden', aiMode !== 'create');
  getEl('aiImproveInput')?.classList.toggle('is-hidden', aiMode !== 'improve');

  const button = getEl('btnAiGenerate');
  if (button) button.textContent = aiMode === 'create' ? 'Сгенерировать' : 'Улучшить текст';
  renderAiResults();
  setText('aiError', '');
  getEl('aiError')?.classList.add('is-hidden');
}

function parseAiVariants(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const normalized = text
    .replace(/\r/g, '')
    .replace(/(?:^|\n)\s*(?:[-•]\s*)?Вариант\s*\d+\s*[:.]\s*/gi, '\n@@VARIANT@@')
    .trim();

  const chunks = normalized
    .split('@@VARIANT@@')
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length > 1) return chunks.slice(0, 3);

  return text
    .split(/\n{2,}/)
    .map((part) => part.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function renderAiResults() {
  const container = getEl('aiResults');
  const empty = getEl('aiEmptyState');
  if (!container) return;
  if (empty) empty.classList.toggle('is-hidden', aiResults.length > 0 || aiIsGenerating);
  container.innerHTML = aiResults.map((variant, index) => {
    const key = getAiVariantKey(variant);
    const isAdded = aiAddedVariantKeys.has(key);
    return `
    <div class="ai-result-card${isAdded ? ' is-added' : ''}">
      <div class="ai-result-title">
        <span>Вариант ${index + 1}</span>
        ${isAdded ? '<em>Добавлено</em>' : ''}
      </div>
      <div class="ai-result-text">${escHtml(variant)}</div>
      <div class="ai-result-actions">
        <button class="btn ${isAdded ? 'btn-ghost' : 'btn-secondary'} btn-sm" type="button" onclick="addAiVariantToFolder(${index})" ${isAdded ? 'disabled' : ''}>${isAdded ? 'Добавлено в папку' : 'Добавить в папку'}</button>
        <button class="ai-rate-btn" type="button" onclick="showAiFeedback(${index}, 'liked')" title="Понравилось">👍</button>
        <button class="ai-rate-btn" type="button" onclick="showAiFeedback(${index}, 'disliked')" title="Не подошло">👎</button>
      </div>
      <div class="ai-feedback is-hidden" id="aiFeedback${index}">
        <input id="aiFeedbackInput${index}" type="text" placeholder="Что понравилось?">
        <button class="btn btn-primary btn-sm" type="button" onclick="saveAiFeedback(${index})">Сохранить</button>
      </div>
    </div>`;
  }).join('');
}

function getAiVariantKey(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function useAiHint(text) {
  const input = getEl('aiCreateInput');
  if (aiMode !== 'create') setAiMode('create');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function generateAiText() {
  if (aiIsGenerating) return;
  if (!aiConnected) {
    showAiKeySetup();
    showToast('Подключите ИИ', 'err');
    return;
  }

  const input = aiMode === 'create' ? getEl('aiCreateInput') : getEl('aiImproveInput');
  const text = String(input?.value || '').trim();
  const button = getEl('btnAiGenerate');
  const loader = getEl('aiLoader');
  const errorBox = getEl('aiError');

  if (!text) {
    if (errorBox) {
      errorBox.textContent = aiMode === 'create' ? 'Напишите тему сообщения.' : 'Вставьте текст, который нужно улучшить.';
      errorBox.classList.remove('is-hidden');
    }
    return;
  }

  const now = Date.now();
  if (now - lastAiRequestAt < 2000) {
    showToast('Подождите пару секунд перед новым запросом', 'err');
    return;
  }
  lastAiRequestAt = now;

  aiIsGenerating = true;
  if (button) button.disabled = true;
  loader?.classList.remove('is-hidden');
  errorBox?.classList.add('is-hidden');
  aiResults = [];
  aiAddedVariantKeys.clear();
  renderAiResults();

  try {
    const result = await window.api.openRouterGenerate?.({ mode: aiMode, text });
    if (!result?.ok) throw new Error(result?.error || 'unknown');

    aiResults = parseAiVariants(result.text);
    if (!aiResults.length && result.text) aiResults = [result.text.trim()];
    renderAiResults();
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = getAiErrorMessage(error?.message);
      errorBox.classList.remove('is-hidden');
    }
  } finally {
    aiIsGenerating = false;
    if (button) button.disabled = false;
    loader?.classList.add('is-hidden');
    renderAiResults();
  }
}

function addAiVariantToFolder(index) {
  const text = aiResults[index];
  if (!text) return;
  if (!currentMessageFolderId) {
    showToast('Выберите папку сообщений', 'err');
    return;
  }

  const emptyIndex = messages.findIndex((message) => !String(message || '').trim());
  if (emptyIndex >= 0) {
    messages[emptyIndex] = text;
  } else if (messages.length < 5) {
    messages.push(text);
  } else {
    showToast('В папке уже 5 вариантов. Удалите лишний вариант и добавьте текст снова.', 'err');
    return;
  }

  syncCurrentFolderFromMessages();
  renderMessages();
  aiAddedVariantKeys.add(getAiVariantKey(text));
  renderAiResults();
  showToast('Текст добавлен в папку. Нажмите «Сохранить», когда будете готовы.', 'ok');
}

function showAiFeedback(index, tone) {
  const box = getEl(`aiFeedback${index}`);
  const input = getEl(`aiFeedbackInput${index}`);
  if (!box || !input) return;
  box.dataset.tone = tone === 'disliked' ? 'disliked' : 'liked';
  input.placeholder = tone === 'disliked' ? 'Что не так?' : 'Что понравилось?';
  box.classList.remove('is-hidden');
  input.focus();
}

async function saveAiFeedback(index) {
  const box = getEl(`aiFeedback${index}`);
  const input = getEl(`aiFeedbackInput${index}`);
  if (!box) return;
  const tone = box.dataset.tone === 'disliked' ? 'disliked' : 'liked';
  try {
    await window.api.aiFeedbackSave?.({
      tone,
      mode: aiMode,
      reason: input?.value || '',
    });
    box.classList.add('is-hidden');
    showToast('Оценка сохранена', 'ok');
  } catch (error) {
    showToast('Не удалось сохранить оценку', 'err');
  }
}

// ─── Messages ────────────────────────────────────────────────────
function renderMessages() {
  const container = getEl('messageVariants');
  if (!container) return;
  container.innerHTML = '';
  if (!messages.length) messages = [''];

  messages.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'message-variant animate-in';
    div.innerHTML = `
      <div class="variant-header">
        <span class="variant-badge">Вариант ${i + 1}</span>
        ${messages.length > 1
          ? `<button class="btn btn-danger btn-sm" onclick="removeVariant(${i})">Удалить вариант</button>`
          : ''}
      </div>
      <textarea
        placeholder="Напишите сообщение для клиента..."
        rows="4"
        onchange="messages[${i}] = this.value; syncCurrentFolderFromMessages(); autoSaveMessages()"
        oninput="messages[${i}] = this.value; syncCurrentFolderFromMessages(); autoSaveMessages()"
      >${escHtml(text)}</textarea>`;
    container.appendChild(div);
  });

  const addBtn = getEl('btnAddVariant');
  if (addBtn) addBtn.disabled = messages.length >= 5;
  updatePreview();
  updateDashboardSummary();
}

function addVariant() {
  if (messages.length >= 5) return;
  messages.push('');
  syncCurrentFolderFromMessages();
  renderMessages();
  autoSaveMessages();
}

function removeVariant(i) {
  messages.splice(i, 1);
  if (!messages.length) messages = [''];
  syncCurrentFolderFromMessages();
  renderMessages();
  autoSaveMessages();
}

let saveTimer;
function autoSaveMessages() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveMessagesStore({ silent: true, render: false });
  }, 1000);
  updatePreview();
}

async function saveMessages() {
  try {
    const saved = await saveMessagesStore({ silent: false, render: false });
    if (!saved) return;
    const btn = getEl('btnSaveMessages');
    if (btn) {
      const orig = btn.innerHTML;
      btn.dataset.state = 'success';
      btn.innerHTML = '✓ Сохранено';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.dataset.state = 'idle';
      }, 1500);
    }
    updatePreview();
    updateDashboardSummary();
    showToast('Сообщения сохранены', 'ok');
  } catch (error) {
    reportError('Не удалось сохранить сообщения', error);
  }
}

function showPreview() { updatePreview(); }

function updatePreview() {
  const valid = messages.filter((message) => message && message.trim());
  const folder = getActiveMessageFolder();
  const card = getEl('previewCard');
  const preview = getEl('previewText');
  const previewImageWrap = getEl('previewImageWrap');
  const previewImage = getEl('previewImage');
  const shuffleBtn = getEl('previewShuffleBtn');
  if (!card || !preview) return;

  if (valid.length) {
    card.style.display = 'block';
    preview.textContent = valid[Math.floor(Math.random() * valid.length)];
  } else {
    card.style.display = 'none';
  }

  if (previewImageWrap && previewImage) {
    const imagePath = folder?.image?.path ? `file://${folder.image.path}` : '';
    previewImageWrap.style.display = imagePath ? 'block' : 'none';
    previewImage.src = imagePath;
  }

  if (shuffleBtn) {
    shuffleBtn.style.display = valid.length > 1 ? 'inline-flex' : 'none';
  }

  updateDashboardSummary();
}

// ─── Sending ─────────────────────────────────────────────────────
async function startSending() {
  if (isSending) return;

  const runId = Date.now();
  activeSendRunId = runId;
  isSending = true;
  setBtnState(true);

  try {
    const hasAccounts = await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId,
      preferredSendAccount: getSelectedSendAccountId(),
      silent: true,
    });
    if (!hasAccounts) {
      setStatus('sendStatus', 'Нет доступных аккаунтов WhatsApp.', 'err');
      showToast('Нет доступных аккаунтов WhatsApp', 'err');
      return;
    }

    currentSendAccountId = resolveAccountId(getSelectedSendAccountId(), currentActiveAccountId);
    currentActiveAccountId = currentSendAccountId;
    persistUiSetting(STORAGE_KEYS.sendAccount, currentSendAccountId);
    persistUiSetting(STORAGE_KEYS.activeAccount, currentActiveAccountId);
    await setActiveAccountUi(currentActiveAccountId, { silent: true });

    const sendContacts = await getContactsForSending();
    if (!sendContacts.length) {
      const message = currentSendBase
        ? `База «${getBaseLabel(currentSendBase)}» пуста.`
        : 'Выберите базу для рассылки.';
      setStatus('sendStatus', message, 'err');
      showToast(message, 'err');
      return;
    }
    const removedOnLoad = Number(lastSendLoadInfo?.removedDuplicates || 0);
    if (removedOnLoad > 0) {
      setStatus('sendStatus', `Перед отправкой удалено дублей: ${removedOnLoad}`, 'warn');
    }

    syncCurrentFolderFromMessages();
    const folder = getActiveMessageFolder();
    const validMsg = (folder?.variants || []).filter((message) => message && message.trim());
    if (!validMsg.length) {
      setStatus('sendStatus', 'В выбранной папке нет текста для отправки.', 'err');
      showToast('Добавьте текст в папку сообщений.', 'err');
      return;
    }

    const requestedCount = parseInt(getEl('sendCount')?.value, 10);
    const delayMin = parseInt(getEl('delayMin')?.value, 10);
    const delayMax = parseInt(getEl('delayMax')?.value, 10);
    const safeMode = !!getEl('safeMode')?.checked;
    const repeatMode = getEl('sendRepeatMode')?.value || 'skip-ever';
    const skipDays = parseInt(getEl('skipDays')?.value, 10) || 0;
    const count = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 0;

    persistUiSetting(STORAGE_KEYS.sendCount, String(requestedCount));
    persistUiSetting(STORAGE_KEYS.delayMin, String(delayMin));
    persistUiSetting(STORAGE_KEYS.delayMax, String(delayMax));
    persistUiSetting(STORAGE_KEYS.safeMode, safeMode ? '1' : '0');
    persistUiSetting(STORAGE_KEYS.sendRepeatMode, repeatMode);
    persistUiSetting(STORAGE_KEYS.skipDays, String(skipDays));

    if (!count) {
      setStatus('sendStatus', 'Укажите корректное количество контактов для рассылки.', 'err');
      showToast('Укажите количество контактов для рассылки.', 'err');
      return;
    }

    if (!Number.isFinite(delayMin) || !Number.isFinite(delayMax) || delayMin >= delayMax) {
      setStatus('sendStatus', 'Задержка "от" должна быть меньше задержки "до".', 'err');
      showToast('Проверьте интервал задержки.', 'err');
      return;
    }

    totalToSend = Math.min(count, sendContacts.length);
    const repeatLabels = {
      'skip-ever': 'не писать уже отправленным',
      'skip-days': `не писать повторно ${skipDays} дн.`,
      allow: 'повторы разрешены',
    };
    const confirmed = await showConfirmDialog({
      title: 'Запустить рассылку?',
      body: `
        <div class="confirm-summary">
          <div><span>База</span><strong>${escHtml(getBaseLabel(currentSendBase))}</strong></div>
          <div><span>Аккаунт</span><strong>${escHtml(getAccountLabel(currentSendAccountId))}</strong></div>
          <div><span>Папка сообщений</span><strong>${escHtml(folder?.name || 'Не выбрана')}</strong></div>
          <div><span>Контакты</span><strong>${formatCountRu(totalToSend, RU_FORMS.contact)}</strong></div>
          <div><span>Повторы</span><strong>${escHtml(repeatLabels[repeatMode] || repeatLabels['skip-ever'])}</strong></div>
          <div><span>Изображение</span><strong>${folder?.image?.path ? 'прикреплено' : 'без изображения'}</strong></div>
        </div>`,
      confirmText: 'Запустить',
      tone: 'primary',
    });
    if (!confirmed) return;

    resetStats(totalToSend);
    const dedupeNotice = removedOnLoad > 0 ? `Перед отправкой удалено дублей: ${removedOnLoad}. ` : '';
    setStatus('sendStatus', `${dedupeNotice}Запуск рассылки: ${formatCountRu(totalToSend, RU_FORMS.contact)}, папка «${folder.name}», аккаунт «${getAccountLabel(currentSendAccountId)}».`, 'warn');
    addLog(`Старт: ${formatCountRu(totalToSend, RU_FORMS.recipient)} из базы «${getBaseLabel(currentSendBase)}», папка «${folder.name}», повторы: ${repeatLabels[repeatMode] || repeatLabels['skip-ever']}, задержка ${delayMin}-${delayMax}с`, 'info');
    setSendState('Отправка...', 'progress');
    updateSendProgressSummary({ sent: 0, errors: 0, remaining: totalToSend, total: totalToSend });

    const res = await window.api.waSend(currentSendAccountId, {
      baseId: currentSendBase,
      contacts: sendContacts,
      messages: validMsg,
      opts: { count, delayMin, delayMax, safeMode, repeatMode, skipSentWithinDays: skipDays, imagePath: folder?.image?.path || null },
    });

    if (activeSendRunId !== runId) return;

    if (res?.ok) {
      if (Number(res.removedBeforeSend || 0) > 0) {
        addLog(`Перед отправкой удалено дублей: ${res.removedBeforeSend}`, 'warn');
      }
      const sentCount = Number(res.sent || 0);
      const skippedCount = Number(res.skipped || 0);
      const statusType = sentCount > 0 ? 'ok' : (skippedCount > 0 ? 'warn' : 'ok');
      setStatus('sendStatus', `Готово: отправлено ${formatCountRu(sentCount, RU_FORMS.message)}, ${formatCountRu(res.errors || 0, RU_FORMS.error)}, пропущено ${formatCountRu(skippedCount, RU_FORMS.contact)}`, statusType);
      addLog(`ГОТОВО: отправлено ${formatCountRu(res.sent || 0, RU_FORMS.message)}, ${formatCountRu(res.errors || 0, RU_FORMS.error)}`, 'ok');
      showToast('Рассылка завершена', 'ok');
      setSendState('Готово', 'success');
    } else {
      const message = res?.error || 'Неизвестная ошибка отправки';
      setStatus('sendStatus', 'Ошибка: ' + message, 'err');
      addLog('ОШИБКА: ' + message, 'err');
      showToast('Рассылка завершилась с ошибкой', 'err');
      setSendState('Ошибка', 'error');
    }
  } catch (error) {
    if (activeSendRunId !== runId) return;
    reportError('Рассылка завершилась с ошибкой', error, { statusId: 'sendStatus' });
    setSendState('Ошибка', 'error');
  } finally {
    if (activeSendRunId === runId) {
      activeSendRunId = 0;
      isSending = false;
      setBtnState(false);
    }
  }
}

function normalizeManualPhone(value) {
  const cleaned = String(value || '').replace(/[^\d+]/g, '');
  if (!/^\+?\d{10,15}$/.test(cleaned)) return '';
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function showTestRecipientsDialog(baseContacts = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    let settled = false;
    const baseKeys = new Set(baseContacts.map((contact) => normalizePhoneKey(contact?.phone)).filter(Boolean));
    let selected = testSelectedContacts
      .filter(Boolean)
      .filter((contact) => baseKeys.has(normalizePhoneKey(contact?.phone)))
      .slice(0, 5)
      .map((contact) => ({ ...contact, source: contact.source || 'test' }));
    let query = '';
    let timer = null;

    const finish = (value = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      overlay.remove();
      resolve(Array.isArray(value) ? value : []);
    };

    const selectedKeySet = () => new Set(selected.map((contact) => normalizePhoneKey(contact?.phone)).filter(Boolean));
    const renderSelected = () => {
      const list = overlay.querySelector('#testSelectedList');
      const counter = overlay.querySelector('#testSelectedCounter');
      if (counter) counter.textContent = `${selected.length} / 5 из базы`;
      if (!list) return;
      if (!selected.length) {
        list.innerHTML = '<div class="empty-mini">Контакты из базы не выбраны.</div>';
        return;
      }
      list.innerHTML = selected.map((contact) => `
        <button class="selected-pill" type="button" data-phone="${escHtml(normalizePhoneKey(contact.phone))}">
          <span>${escHtml(contact.name || contact.phone)}</span>
          <strong>${escHtml(contact.phone)}</strong>
        </button>
      `).join('');
    };

    const renderResults = () => {
      const list = overlay.querySelector('#testSearchResults');
      if (!list) return;
      const normalizedQuery = query.toLocaleLowerCase('ru-RU');
      const phoneQuery = normalizePhoneKey(query);
      const selectedKeys = selectedKeySet();
      const results = baseContacts
        .filter((contact) => {
          if (!normalizedQuery) return true;
          const name = String(contact?.name || '').toLocaleLowerCase('ru-RU');
          const phone = String(contact?.phone || '').toLocaleLowerCase('ru-RU');
          return name.includes(normalizedQuery) || phone.includes(normalizedQuery) || (phoneQuery && normalizePhoneKey(phone).includes(phoneQuery));
        })
        .slice(0, 30);

      if (!results.length) {
        list.innerHTML = '<div class="empty-mini">Контакт не найден. Проверьте номер или имя.</div>';
        return;
      }

      list.innerHTML = results.map((contact) => {
        const key = normalizePhoneKey(contact.phone);
        const isSelected = selectedKeys.has(key);
        return `
          <div class="test-result">
            <div>
              <strong title="${escHtml(contact.name || contact.phone)}">${escHtml(contact.name || 'Без имени')}</strong>
              <span>${escHtml(contact.phone)}</span>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" data-test-phone="${escHtml(key)}">${isSelected ? 'Убрать' : 'Выбрать'}</button>
          </div>
        `;
      }).join('');
    };

    const update = () => {
      renderSelected();
      renderResults();
    };

    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box modal-box-wide">
        <div class="modal-title">Тестовая рассылка</div>
        <div class="modal-body">
          <div class="test-grid">
            <div>
              <label for="testContactSearch">Контакты из базы</label>
              <input type="search" id="testContactSearch" placeholder="Поиск по имени или номеру">
              <div class="test-counter" id="testSelectedCounter">0 / 5 из базы</div>
              <div class="test-results" id="testSearchResults"></div>
            </div>
            <div>
              <label>Выбраны из базы</label>
              <div class="selected-list" id="testSelectedList"></div>
              <label for="testManualPhones">Номера вручную</label>
              <textarea id="testManualPhones" rows="6" placeholder="+77001234567&#10;+77007654321"></textarea>
              <div class="input-helper">До 5 номеров, каждый с новой строки.</div>
              <div class="field-error" id="testRecipientsError"></div>
            </div>
          </div>
        </div>
        <div class="modal-btns">
          <button class="btn btn-warning btn-sm" id="testConfirm">Отправить тест</button>
          <button class="btn btn-ghost btn-sm" id="testCancel">Отмена</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    update();

    const searchInput = overlay.querySelector('#testContactSearch');
    const manualInput = overlay.querySelector('#testManualPhones');
    const errorEl = overlay.querySelector('#testRecipientsError');

    searchInput?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = searchInput.value || '';
        renderResults();
      }, 180);
    });

    overlay.querySelector('#testSearchResults')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-test-phone]');
      if (!button) return;
      const key = button.dataset.testPhone;
      if (!key) return;

      if (selectedKeySet().has(key)) {
        selected = selected.filter((contact) => normalizePhoneKey(contact.phone) !== key);
        update();
        return;
      }

      if (selected.length >= 5) {
        if (errorEl) errorEl.textContent = 'Из базы можно выбрать до 5 контактов.';
        return;
      }

      const contact = baseContacts.find((item) => normalizePhoneKey(item?.phone) === key);
      if (contact) selected.push(contact);
      if (errorEl) errorEl.textContent = '';
      update();
    });

    overlay.querySelector('#testSelectedList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-phone]');
      if (!button) return;
      selected = selected.filter((contact) => normalizePhoneKey(contact.phone) !== button.dataset.phone);
      update();
    });

    overlay.querySelector('#testConfirm')?.addEventListener('click', () => {
      const manualRaw = String(manualInput?.value || '')
        .split(/\r?\n|,|;/)
        .map(normalizeManualPhone)
        .filter(Boolean);
      const manual = [];
      const seenManual = new Set();
      for (const phone of manualRaw) {
        const key = normalizePhoneKey(phone);
        if (!key || seenManual.has(key)) continue;
        seenManual.add(key);
        manual.push({ name: phone, phone, source: 'test-manual' });
        if (manual.length >= 5) break;
      }

      if (manualRaw.length > 5 && errorEl) {
        errorEl.textContent = 'Вручную можно ввести до 5 номеров. Лишние номера не будут отправлены.';
      }

      const combined = [];
      const seen = new Set();
      [...selected, ...manual].forEach((contact) => {
        const key = normalizePhoneKey(contact?.phone);
        if (!key || seen.has(key)) return;
        seen.add(key);
        combined.push(contact);
      });

      if (!combined.length) {
        if (errorEl) errorEl.textContent = 'Выберите контакт или введите номер для теста.';
        return;
      }

      testSelectedContacts = selected.slice(0, 5);
      renderContactList();
      finish(combined);
    });

    overlay.querySelector('#testCancel')?.addEventListener('click', () => finish([]));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish([]);
    });
  });
}

async function sendTest() {
  if (isSending) return;

  let runId = 0;
  try {
    const hasAccounts = await refreshAccounts({
      preferredActiveAccount: currentActiveAccountId,
      preferredSendAccount: getSelectedSendAccountId(),
      silent: true,
    });
    if (!hasAccounts) {
      setStatus('sendStatus', 'Нет доступных аккаунтов WhatsApp.', 'err');
      showToast('Нет доступных аккаунтов WhatsApp', 'err');
      return;
    }

    currentSendAccountId = resolveAccountId(getSelectedSendAccountId(), currentActiveAccountId);
    currentActiveAccountId = currentSendAccountId;
    persistUiSetting(STORAGE_KEYS.sendAccount, currentSendAccountId);
    persistUiSetting(STORAGE_KEYS.activeAccount, currentActiveAccountId);
    await setActiveAccountUi(currentActiveAccountId, { silent: true });

    const sendContacts = await getContactsForSending();
    syncCurrentFolderFromMessages();
    const folder = getActiveMessageFolder();
    const validMsg = (folder?.variants || []).filter((message) => message && message.trim());
    if (!validMsg.length) {
      setStatus('sendStatus', 'В выбранной папке нет текста для теста.', 'err');
      showToast('Добавьте текст в папку сообщений.', 'err');
      return;
    }

    const testContacts = await showTestRecipientsDialog(sendContacts);
    if (!testContacts.length) return;

    runId = Date.now();
    activeSendRunId = runId;
    isSending = true;
    setBtnState(true);

    totalToSend = testContacts.length;
    resetStats(totalToSend);
    setStatus('sendStatus', `Тестовая отправка: ${formatCountRu(testContacts.length, RU_FORMS.recipient)}, папка «${folder.name}».`, 'warn');
    addLog(`ТЕСТ: ${formatCountRu(testContacts.length, RU_FORMS.recipient)}, папка «${folder.name}», аккаунт «${getAccountLabel(currentSendAccountId)}»`, 'warn');
    setSendState('Тест', 'warning');

    const res = await window.api.waSend(currentSendAccountId, {
      baseId: currentSendBase,
      contacts: testContacts,
      messages: validMsg,
      opts: { count: testContacts.length, delayMin: 5, delayMax: 10, safeMode: false, skipSentWithinDays: 0, testMode: true, imagePath: folder?.image?.path || null },
    });

    if (activeSendRunId !== runId) return;

    if (res?.ok && res.sent > 0) {
      setStatus('sendStatus', `✓ Тест отправлен: ${formatCountRu(res.sent, RU_FORMS.recipient)}`, 'ok');
      addLog(`ТЕСТ УСПЕШЕН: ${res.sent} отправлено`, 'ok');
      showToast('Тестовое сообщение отправлено', 'ok');
      setSendState('Тест пройден', 'success');
    } else {
      setStatus('sendStatus', 'Тест не удался', 'err');
      addLog('ТЕСТ НЕУДАЧЕН', 'err');
      showToast('Тестовая отправка не удалась', 'err');
      setSendState('Ошибка', 'error');
    }
  } catch (error) {
    if (activeSendRunId && activeSendRunId !== runId) return;
    reportError('Не удалось выполнить тестовую отправку', error, { statusId: 'sendStatus' });
    setSendState('Ошибка', 'error');
  } finally {
    if (!activeSendRunId || activeSendRunId === runId) {
      activeSendRunId = 0;
      isSending = false;
      setBtnState(false);
    }
  }
}

async function stopSending() {
  if (!isSending) return;

  activeSendRunId = 0;
  isSending = false;
  setBtnState(false);

  try {
    await window.api.waStop(currentSendAccountId || currentActiveAccountId);
    setStatus('sendStatus', 'Остановлено пользователем', 'warn');
    addLog('ОСТАНОВЛЕНО', 'warn');
    showToast('Рассылка остановлена', 'warn');
    setSendState('Остановлено', 'warning');
  } catch (error) {
    reportError('Не удалось остановить рассылку', error, { statusId: 'sendStatus' });
    setSendState('Ошибка', 'error');
  }
}

function handleProgress(data) {
  if (!data || (!isSending && activeSendRunId === 0)) return;
  const progressAccountId = resolveAccountId(data.accountId, currentSendAccountId || currentActiveAccountId);
  if ((currentSendAccountId || currentActiveAccountId) && progressAccountId !== (currentSendAccountId || currentActiveAccountId)) {
    return;
  }

  const sent      = data.sent || 0;
  const errors    = data.errors || 0;
  const remaining = data.remaining || 0;

  const statSentVal = getEl('statSentVal');
  const statErrorsVal = getEl('statErrorsVal');
  const statRemaining = getEl('statRemaining');
  const statSent = getEl('statSent');
  const statErrors = getEl('statErrors');
  const progressBar = getEl('progressBar');

  if (statSentVal) statSentVal.textContent = sent;
  if (statErrorsVal) statErrorsVal.textContent = errors;
  if (statRemaining) statRemaining.textContent = remaining;

  if (statSent) statSent.className = 'stat-card' + (sent > 0 ? ' highlight-green' : '');
  if (statErrors) statErrors.className = 'stat-card' + (errors > 0 ? ' highlight-red' : '');

  if (progressBar && totalToSend > 0) {
    progressBar.style.width = Math.min(((sent + errors) / totalToSend) * 100, 100) + '%';
  }

  updateSendProgressSummary({ sent, errors, remaining, total: totalToSend });

  switch (data.type) {
    case 'sent':
      setStatus('sendStatus', `✓ Отправлено: ${data.name || data.phone}`, 'ok');
      addLog(`ОТПРАВЛЕНО → ${data.phone}`, 'ok');
      setSendState('Отправка...', 'progress');
      break;
    case 'error':
      setStatus('sendStatus', `✗ Ошибка: ${data.phone}`, 'err');
      addLog(`ОШИБКА → ${data.phone}`, 'err');
      setSendState('Отправка...', 'progress');
      break;
    case 'skip':
      addLog(`ПРОПУЩЕН (уже писали) → ${data.phone}`, 'info');
      setSendState('Отправка...', 'progress');
      break;
    case 'waiting':
      setStatus('sendStatus', `Пауза ${data.delay}с перед следующим...`, 'warn');
      setSendState('Пауза', 'warning');
      break;
    case 'pause':
      setStatus('sendStatus', data.message, 'warn');
      addLog('ПАУЗА: ' + data.message, 'warn');
      setSendState('Пауза', 'warning');
      break;
    case 'auto-stop':
      setStatus('sendStatus', 'Авто-стоп: слишком много ошибок', 'err');
      addLog('АВТО-СТОП', 'err');
      setSendState('Авто-стоп', 'error');
      break;
  }
}

function resetStats(total) {
  const statSentVal = getEl('statSentVal');
  const statErrorsVal = getEl('statErrorsVal');
  const statRemaining = getEl('statRemaining');
  const progressBar = getEl('progressBar');
  const statSent = getEl('statSent');
  const statErrors = getEl('statErrors');
  const logArea = getEl('logArea');

  if (statSentVal) statSentVal.textContent = '0';
  if (statErrorsVal) statErrorsVal.textContent = '0';
  if (statRemaining) statRemaining.textContent = total;
  if (progressBar) progressBar.style.width = '0%';
  if (statSent) statSent.className = 'stat-card';
  if (statErrors) statErrors.className = 'stat-card';
  if (logArea) logArea.innerHTML = '<div class="log-line info">[ Подготовка к отправке... ]</div>';
  updateSendProgressSummary({ sent: 0, errors: 0, remaining: total, total });
}

function setBtnState(sending) {
  const btnStart = getEl('btnStart');
  const btnStop = getEl('btnStop');
  const btnTest = getEl('btnTest');

  if (btnStart) {
    btnStart.disabled = sending;
    btnStart.dataset.state = sending ? 'loading' : 'idle';
    btnStart.innerHTML = sending
      ? `<span class="spin">⟳</span> Отправка...`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Запустить рассылку`;
  }

  if (btnStop) {
    btnStop.disabled = !sending;
    btnStop.dataset.state = sending ? 'active' : 'idle';
  }

  if (btnTest) {
    btnTest.disabled = sending;
    btnTest.dataset.state = sending ? 'idle' : 'active';
  }

  ['sendBaseType', 'sendMessageFolderId', 'sendAccountId', 'sendCount', 'sendRepeatMode', 'delayMin', 'delayMax', 'safeMode', 'skipDays', 'btnSelectMessageImage'].forEach(id => {
    const el = getEl(id);
    if (el) el.disabled = sending;
  });
  updateSendRepeatModeUi();

  ['messageFolderSelect', 'btnCreateMessageFolder', 'btnRenameMessageFolder', 'btnDeleteMessageFolder'].forEach(id => {
    const el = getEl(id);
    if (el) el.disabled = sending;
  });

  updateBaseActionButtons();
  renderMessageFolderOptions();
  renderAccountsPanel();
}

// ─── Log ─────────────────────────────────────────────────────────
function addLog(msg, type = 'info') {
  const log = getEl('logArea');
  if (!log) return;

  const shouldStickToBottom = Math.abs(log.scrollHeight - log.scrollTop - log.clientHeight) < 32;
  const placeholder = log.querySelector('.log-line.info');
  if (placeholder && /\[ .* \]/.test(placeholder.textContent || '')) {
    placeholder.remove();
  }

  const now = new Date().toLocaleTimeString('ru-RU');
  const line = document.createElement('div');
  line.className = 'log-line ' + type;
  line.textContent = `[${now}] ${msg}`;
  log.appendChild(line);

  while (log.children.length > LOG_LIMIT) {
    log.removeChild(log.firstElementChild);
  }

  if (shouldStickToBottom) {
    log.scrollTop = log.scrollHeight;
  }
}

// ─── Toast Notification ───────────────────────────────────────────
function showToast(msg, type = 'ok') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  while (stack.children.length >= TOAST_LIMIT) {
    stack.removeChild(stack.firstElementChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─── Helpers ─────────────────────────────────────────────────────
async function loadAppVersion() {
  try {
    const info = await window.api.appInfo?.();
    if (info?.version) setText('appVersionLabel', `Версия ${info.version}`);
  } catch (error) {
    console.warn('[LightFoot] Failed to load app version', error);
  }
}

async function checkForUpdatesManually() {
  showToast('Проверяем обновления...', 'ok');
  const result = await window.api.updatesCheck?.();
  if (result && result.ok === false) {
    showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

async function handleUpdateEvent(event = {}) {
  if (event.status === 'checking') {
    if (event.manual) showToast('Проверяем обновления...', 'ok');
    return;
  }
  if (event.status === 'not-available') {
    showToast('У вас последняя версия', 'ok');
    return;
  }
  if (event.status === 'available') {
    const versionText = event.updateVersion ? ` Версия ${event.updateVersion}.` : '';
    const shouldDownload = await showConfirmDialog({
      title: 'Доступна новая версия LightFoot Sender.',
      body: `Можно скачать обновление сейчас.${versionText}`,
      confirmText: 'Скачать',
      cancelText: 'Позже',
      tone: 'primary',
    });
    if (shouldDownload) window.api.updatesDownload?.();
    return;
  }
  if (event.status === 'downloading') {
    showToast(`Загрузка обновления: ${Math.round(Number(event.percent) || 0)}%`, 'ok');
    return;
  }
  if (event.status === 'downloaded') {
    const shouldInstall = await showConfirmDialog({
      title: 'Обновление готово к установке.',
      body: 'Перезапустите приложение, чтобы установить новую версию. Базы, сообщения, аккаунты и настройки останутся в локальной папке данных.',
      confirmText: 'Перезапустить и установить',
      cancelText: 'Позже',
      tone: 'primary',
    });
    if (shouldInstall) window.api.updatesInstall?.();
    return;
  }
  if (event.status === 'download-error') {
    showToast('Загрузка обновления прервалась. Можно попробовать снова.', 'err');
    return;
  }
  if ((event.status === 'error' || event.status === 'unsupported') && event.manual) {
    showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

function setStatus(id, msg, type = '') {
  const el = getEl(id);
  if (!el) return;
  el.className = 'status-bar ' + type;
  el.textContent = msg;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('error', (event) => {
  reportError('Ошибка интерфейса', event?.error || event?.message, { toast: false });
});

window.addEventListener('unhandledrejection', (event) => {
  reportError('Необработанная ошибка', event?.reason, { toast: false });
});

// ─── Window exports (required for Electron contextIsolation) ────────
// Inline onclick="" attributes in HTML and dynamically-generated innerHTML
// cannot reach module-scoped functions when contextIsolation is true.
// Assigning to window makes them accessible from the page's global scope.
async function checkForUpdatesManuallyFriendly() {
  showToast('Проверяем обновления...', 'ok');
  const result = await window.api.updatesCheck?.();
  if (result && result.ok === false) {
    const isMissingRelease = result.status === 'not-available' || result.status === 'unsupported';
    showToast(isMissingRelease ? 'Обновления пока не найдены' : 'Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', isMissingRelease ? 'ok' : 'err');
  }
}

async function handleUpdateEventFriendly(event = {}) {
  if (event.status === 'checking') return;

  if (event.status === 'not-available' || event.status === 'unsupported') {
    if (event.manual) showToast('Обновления пока не найдены', 'ok');
    return;
  }

  if (event.status === 'available') {
    const versionText = event.updateVersion ? ` Версия ${event.updateVersion}.` : '';
    const shouldDownload = await showConfirmDialog({
      title: 'Доступна новая версия LightFoot Sender.',
      body: `Можно скачать обновление сейчас.${versionText}`,
      confirmText: 'Скачать',
      cancelText: 'Позже',
      tone: 'primary',
    });
    if (shouldDownload) window.api.updatesDownload?.();
    return;
  }

  if (event.status === 'downloading') {
    showToast(`Загрузка обновления: ${Math.round(Number(event.percent) || 0)}%`, 'ok');
    return;
  }

  if (event.status === 'downloaded') {
    const shouldInstall = await showConfirmDialog({
      title: 'Обновление готово к установке.',
      body: 'Перезапустите приложение, чтобы установить новую версию. Базы, сообщения, аккаунты и настройки останутся в локальной папке данных.',
      confirmText: 'Перезапустить и установить',
      cancelText: 'Позже',
      tone: 'primary',
    });
    if (shouldInstall) window.api.updatesInstall?.();
    return;
  }

  if (event.status === 'download-error') {
    showToast('Загрузка обновления прервалась. Можно попробовать снова.', 'err');
    return;
  }

  if (event.status === 'error' && event.manual) {
    showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

function normalizeReleaseNotes(notes) {
  if (Array.isArray(notes)) {
    return notes
      .map((item) => (typeof item === 'string' ? item : item?.note || item?.notes || item?.version || ''))
      .filter(Boolean)
      .join('\n');
  }
  return String(notes || '').trim();
}

function closeUpdatePanel() {
  document.querySelector('.update-panel')?.remove();
}

function renderUpdatePanel({ state, title, text, version = '', notes = '', percent = 0 } = {}) {
  let panel = document.querySelector('.update-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'update-panel';
    document.body.appendChild(panel);
  }

  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const releaseNotes = normalizeReleaseNotes(notes);
  const showProgress = state === 'downloading' || state === 'downloaded';
  const showNotes = releaseNotes && (state === 'available' || state === 'downloaded');

  panel.dataset.state = state || 'idle';
  panel.innerHTML = `
    <div class="update-panel-head">
      <div>
        <div class="update-panel-kicker">LightFoot Sender</div>
        <div class="update-panel-title">${escHtml(title || 'Обновление')}</div>
      </div>
      <button class="update-panel-close" type="button" title="Закрыть">×</button>
    </div>
    <div class="update-panel-text">${escHtml(text || '')}</div>
    ${showProgress ? `
      <div class="update-progress">
        <div class="update-progress-line">
          <span>Скачивание обновления...</span>
          <strong>${Math.round(safePercent)}%</strong>
        </div>
        <div class="update-progress-track">
          <div class="update-progress-bar" style="width: ${safePercent}%"></div>
        </div>
      </div>
    ` : ''}
    ${showNotes ? `
      <details class="update-notes">
        <summary>Что нового${version ? ` в ${escHtml(version)}` : ''}</summary>
        <div>${escHtml(releaseNotes).replace(/\n/g, '<br>')}</div>
      </details>
    ` : ''}
    <div class="update-panel-actions">
      ${state === 'available' || state === 'error' ? '<button class="btn btn-primary btn-sm" type="button" data-update-action="download">Обновить</button>' : ''}
      ${state === 'downloaded' ? '<button class="btn btn-primary btn-sm" type="button" data-update-action="install">Перезапустить и обновить</button>' : ''}
      ${state === 'available' || state === 'downloaded' || state === 'error' ? '<button class="btn btn-secondary btn-sm" type="button" data-update-action="later">Позже</button>' : ''}
    </div>
  `;

  panel.querySelector('.update-panel-close')?.addEventListener('click', closeUpdatePanel);
  panel.querySelector('[data-update-action="later"]')?.addEventListener('click', closeUpdatePanel);
  panel.querySelector('[data-update-action="download"]')?.addEventListener('click', () => window.api.updatesDownload?.());
  panel.querySelector('[data-update-action="install"]')?.addEventListener('click', () => window.api.updatesInstall?.());
}

async function checkForUpdatesManuallyFriendly() {
  showToast('Проверяем обновления...', 'ok');
  const result = await window.api.updatesCheck?.();
  if (result && result.ok === false) {
    const isMissingRelease = result.status === 'not-available' || result.status === 'unsupported';
    showToast(isMissingRelease ? 'Обновления пока не найдены' : 'Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', isMissingRelease ? 'ok' : 'err');
  }
}

async function handleUpdateEventFriendly(event = {}) {
  if (event.status === 'checking') {
    showToast('Проверяем обновления...', 'ok');
    return;
  }

  if (event.status === 'not-available' || event.status === 'unsupported') {
    closeUpdatePanel();
    if (event.manual) showToast('Обновления пока не найдены', 'ok');
    return;
  }

  if (event.status === 'available') {
    renderUpdatePanel({
      state: 'available',
      version: event.updateVersion,
      notes: event.releaseNotes,
      title: `Доступна новая версия${event.updateVersion ? ` ${event.updateVersion}` : ''}`,
      text: 'Можно обновиться сейчас или продолжить работу и вернуться позже.',
    });
    return;
  }

  if (event.status === 'downloading') {
    renderUpdatePanel({
      state: 'downloading',
      percent: Math.round(Number(event.percent) || 0),
      title: 'Скачивание обновления...',
      text: 'Можно продолжать работу. Мы сообщим, когда всё будет готово.',
    });
    return;
  }

  if (event.status === 'downloaded') {
    renderUpdatePanel({
      state: 'downloaded',
      percent: 100,
      version: event.updateVersion,
      notes: event.releaseNotes,
      title: 'Обновление готово',
      text: 'Перезапустите приложение, чтобы установить новую версию. Данные останутся на месте.',
    });
    return;
  }

  if (event.status === 'download-error') {
    renderUpdatePanel({
      state: 'error',
      title: 'Не удалось скачать обновление',
      text: 'Проверьте интернет или попробуйте позже.',
    });
    return;
    renderUpdatePanel({
      state: 'error',
      title: 'Загрузка прервалась',
      text: 'Можно попробовать скачать обновление снова.',
    });
    return;
  }

  if (event.status === 'error' && event.manual) {
    showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

async function checkForUpdatesManuallyFriendly() {
  showToast('Проверяем обновления...', 'ok');
  const result = await window.api.updatesCheck?.();
  if (result && result.ok === false) {
    showToast(result.status === 'not-available' || result.status === 'unsupported'
      ? 'Обновления пока не найдены'
      : 'Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

async function handleUpdateEventFriendly(event = {}) {
  if (event.status === 'checking') {
    showToast('Проверяем обновления...', 'ok');
    return;
  }

  if (event.status === 'not-available' || event.status === 'unsupported') {
    closeUpdatePanel();
    if (event.manual) showToast('Обновления пока не найдены', 'err');
    return;
  }

  if (event.status === 'available') {
    renderUpdatePanel({
      state: 'available',
      version: event.updateVersion,
      notes: event.releaseNotes,
      title: `Доступна новая версия${event.updateVersion ? ` ${event.updateVersion}` : ''}`,
      text: 'Можно обновиться сейчас или продолжить работу и вернуться позже.',
    });
    return;
  }

  if (event.status === 'downloading') {
    renderUpdatePanel({
      state: 'downloading',
      percent: Math.round(Number(event.percent) || 0),
      title: 'Скачивание обновления...',
      text: 'Можно продолжать работу. Мы сообщим, когда всё будет готово.',
    });
    return;
  }

  if (event.status === 'downloaded') {
    renderUpdatePanel({
      state: 'downloaded',
      percent: 100,
      version: event.updateVersion,
      notes: event.releaseNotes,
      title: 'Обновление готово',
      text: 'Перезапустите приложение, чтобы установить новую версию. Данные останутся на месте.',
    });
    return;
  }

  if (event.status === 'download-error') {
    renderUpdatePanel({
      state: 'error',
      title: 'Загрузка прервалась',
      text: 'Можно попробовать скачать обновление снова.',
    });
    return;
  }

  if (event.status === 'error' && event.manual) {
    showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

function compareVersions(a, b) {
  const left = String(a || '0').split('.').map((part) => parseInt(part, 10) || 0);
  const right = String(b || '0').split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function showWhatsNewModal(version) {
  return new Promise((resolve) => {
    const changes = UPDATE_CHANGELOG[version] || [
      'Улучшена стабильность приложения',
    ];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay whats-new-overlay';
    overlay.innerHTML = `
      <div class="modal-box whats-new-box">
        <div class="modal-title">Что нового</div>
        <div class="modal-body">
          <div class="whats-new-version">Версия ${escHtml(version)}</div>
          <ul class="whats-new-list">
            ${changes.map((item) => `<li>${escHtml(item)}</li>`).join('')}
          </ul>
        </div>
        <div class="modal-btns">
          <button class="btn btn-primary btn-sm" type="button" id="whatsNewOk">Понятно</button>
        </div>
      </div>
    `;
    const close = () => {
      overlay.remove();
      resolve();
    };
    document.body.appendChild(overlay);
    overlay.querySelector('#whatsNewOk')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
  });
}

async function maybeShowWhatsNew(currentVersion) {
  if (!currentVersion) return false;
  const lastSeenVersion = localStorage.getItem(STORAGE_KEYS.lastSeenVersion) || '1.1.0';
  let shown = false;
  if (compareVersions(currentVersion, lastSeenVersion) > 0) {
    shown = true;
    await showWhatsNewModal(currentVersion);
  }
  persistUiSetting(STORAGE_KEYS.lastSeenVersion, currentVersion);
  return shown;
}

const UPDATE_CHANGELOG = {
  '1.2.3': [
    'Переработана логика продолжения сбора базы',
    'Исправлен сбор в уже существующую или импортированную базу',
    'Улучшена защита от дублей при сборе',
    'Исправлено удаление дублей в старых базах',
    'Добавлена диагностика базы контактов',
    'Улучшена стабильность импорта и сохранения контактов',
  ],
  '1.2.2': [
    'Добавлены звуковые уведомления для ИИ',
    'Разделены звуки для suggest и handoff',
    'Добавлен поиск по чатам',
    'Добавлены фильтры чатов',
    'Оптимизирован UI под маленькие экраны',
    'Исправлен интерфейс тестовой рассылки',
    'Исправлена проблема повторной рассылки',
    'Улучшена система дублей контактов',
    'Ярлык приложения снова создаётся на рабочем столе после установки и обновления',
    'Обновлено обучение по новым функциям',
  ],
  '1.2.1': [
    'Добавлено подключение ИИ через API ключ',
    'Реализован экран ввода ключа',
    'Обновлено обучение по ИИ',
  ],
  '1.2.0': [
    'ИИ помощник',
    'Создание и улучшение текста',
    'Добавление вариантов в папки',
    'Оценка ответов',
    'Память ИИ',
    'Продолжение сбора базы',
    'Обучение только по новым функциям',
    'Оптимизация работы',
  ],
  '1.1.1': [
    'Добавлен блок «ИИ» (скоро)',
    'Улучшено отображение обновлений',
    'Обновлён интерфейс уведомлений',
  ],
};

const updateUiState = {
  checking: false,
  downloading: false,
  dismissedVersion: '',
  lastManualCheckAt: 0,
};

function getUpdateChanges(version, notes) {
  if (version && UPDATE_CHANGELOG[version]) return UPDATE_CHANGELOG[version];
  const cleanNotes = normalizeReleaseNotes(notes)
    .replace(/<[^>]+>/g, '\n')
    .split(/\r?\n|•|-/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  return cleanNotes.length ? cleanNotes : ['Улучшена стабильность приложения'];
}

function setUpdateButtonState({ loading = false, status = '' } = {}) {
  const button = getEl('btnCheckUpdates');
  const label = getEl('updateCheckLabel');
  const statusEl = getEl('updateCheckStatus');
  if (button) button.disabled = Boolean(loading);
  if (label) label.textContent = loading ? 'Проверка...' : 'Проверить обновления';
  if (statusEl && status) statusEl.textContent = status;
}

function closeUpdatePanel() {
  document.querySelector('.update-panel')?.remove();
}

function renderUpdatePanel({ state, title, text, version = '', notes = '', percent = 0 } = {}) {
  let overlay = document.querySelector('.update-panel');
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.className = 'update-panel';
    document.body.appendChild(overlay);
  }

  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const changes = getUpdateChanges(version, notes);
  const showProgress = state === 'available' || state === 'downloading' || state === 'downloaded';
  const canDismiss = state === 'available' || state === 'downloaded' || state === 'error';
  const updateButtonDisabled = state === 'downloading' ? 'disabled' : '';

  overlay.dataset.state = state || 'idle';
  overlay.innerHTML = `
    <div class="update-modal-card">
      <div class="update-panel-head">
        <div>
          <div class="update-panel-kicker">LightFoot Sender</div>
          <div class="update-panel-title">${escHtml(title || 'Обновление')}</div>
        </div>
        ${canDismiss ? '<button class="update-panel-close" type="button" title="Позже">×</button>' : ''}
      </div>
      <div class="update-panel-text">${escHtml(text || '')}</div>
      <div class="update-notes update-notes-open">
        <div class="update-notes-title">Что нового</div>
        <ul>${changes.map((item) => `<li>${escHtml(item)}</li>`).join('')}</ul>
      </div>
      ${showProgress ? `
        <div class="update-progress">
          <div class="update-progress-line">
            <span>Скачивание обновления...</span>
            <strong>${Math.round(safePercent)}%</strong>
          </div>
          <div class="update-progress-track">
            <div class="update-progress-bar" style="width: ${safePercent}%"></div>
          </div>
        </div>
      ` : ''}
      <div class="update-panel-actions">
        ${state === 'available' || state === 'downloading' ? `<button class="btn btn-primary btn-sm" type="button" data-update-action="download" ${updateButtonDisabled}>${state === 'downloading' ? 'Скачивается...' : 'Обновить'}</button>` : ''}
        ${state === 'downloaded' ? '<button class="btn btn-primary btn-sm" type="button" data-update-action="install">Перезапустить и обновить</button>' : ''}
        ${canDismiss ? '<button class="btn btn-secondary btn-sm" type="button" data-update-action="later">Позже</button>' : ''}
      </div>
    </div>
  `;

  const dismiss = () => {
    if (version) updateUiState.dismissedVersion = version;
    closeUpdatePanel();
  };
  overlay.querySelector('.update-panel-close')?.addEventListener('click', dismiss);
  overlay.querySelector('[data-update-action="later"]')?.addEventListener('click', dismiss);
  overlay.querySelector('[data-update-action="download"]')?.addEventListener('click', () => {
    if (updateUiState.downloading) return;
    window.api.updatesDownload?.();
  });
  overlay.querySelector('[data-update-action="install"]')?.addEventListener('click', () => window.api.updatesInstall?.());
}

async function lfCheckForUpdatesManually() {
  console.log('[LightFoot][update] manual check clicked');
  if (updateUiState.checking || updateUiState.downloading) {
    showToast(updateUiState.downloading ? 'Уже скачиваем обновление...' : 'Уже проверяем обновления...', 'ok');
    setUpdateButtonState({ loading: updateUiState.checking, status: updateUiState.downloading ? 'Скачивание обновления' : 'Проверка уже запущена' });
    return;
  }

  updateUiState.lastManualCheckAt = Date.now();
  updateUiState.checking = true;
  setUpdateButtonState({ loading: true, status: 'Проверяем обновления...' });
  showToast('Проверяем обновления...', 'ok');

  const result = await window.api.updatesCheck?.();
  if (result?.status === 'busy') {
    showToast(result.flowState === 'downloading' ? 'Уже скачиваем обновление...' : 'Уже проверяем обновления...', 'ok');
    return;
  }
  if (result && result.ok === false && result.status !== 'busy') {
    updateUiState.checking = false;
    setUpdateButtonState({ loading: false, status: result.status === 'not-available' ? 'Обновления актуальны' : 'Проверка не удалась' });
    showToast(result.status === 'not-available' || result.status === 'unsupported' ? 'Актуальная версия' : 'Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', result.status === 'not-available' || result.status === 'unsupported' ? 'ok' : 'err');
  }

  setTimeout(() => {
    if (updateUiState.checking && Date.now() - updateUiState.lastManualCheckAt >= 1800) {
      updateUiState.checking = false;
      updateUiState.lastManualCheckAt = 0;
      setUpdateButtonState({ loading: false, status: 'Проверка завершена' });
      showToast('Проверка завершена', 'ok');
    }
  }, 2200);
}

async function lfHandleUpdateEvent(event = {}) {
  if (event.status === 'checking') {
    updateUiState.checking = true;
    setUpdateButtonState({ loading: Boolean(event.manual) || updateUiState.lastManualCheckAt > 0, status: 'Проверяем обновления...' });
    return;
  }

  if (event.status === 'not-available' || event.status === 'unsupported') {
    updateUiState.checking = false;
    updateUiState.downloading = false;
    updateUiState.lastManualCheckAt = 0;
    closeUpdatePanel();
    setUpdateButtonState({ loading: false, status: 'Обновления актуальны' });
    if (event.manual) showToast('Актуальная версия', 'ok');
    return;
  }

  if (event.status === 'available') {
    updateUiState.checking = false;
    updateUiState.lastManualCheckAt = 0;
    setUpdateButtonState({ loading: false, status: 'Доступна новая версия' });
    if (event.updateVersion !== updateUiState.dismissedVersion) {
      renderUpdatePanel({
        state: 'available',
        version: event.updateVersion,
        notes: event.releaseNotes,
        percent: 0,
        title: `Доступна новая версия ${event.updateVersion || ''}`.trim(),
        text: 'Можно обновиться сейчас или продолжить работу',
      });
    }
    return;
  }

  if (event.status === 'downloading') {
    updateUiState.checking = false;
    updateUiState.downloading = true;
    const percent = Math.round(Number(event.percent) || 0);
    setUpdateButtonState({ loading: true, status: `Скачивание обновления ${percent}%` });
    renderUpdatePanel({
      state: 'downloading',
      version: event.updateVersion,
      notes: event.releaseNotes,
      percent,
      title: `Доступна новая версия ${event.updateVersion || ''}`.trim(),
      text: `Скачивание обновления... ${percent}%`,
    });
    return;
  }

  if (event.status === 'downloaded') {
    updateUiState.downloading = false;
    updateUiState.lastManualCheckAt = 0;
    setUpdateButtonState({ loading: false, status: 'Обновление готово' });
    renderUpdatePanel({
      state: 'downloaded',
      version: event.updateVersion,
      notes: event.releaseNotes,
      percent: 100,
      title: 'Обновление готово',
      text: 'Перезапустите приложение, чтобы установить новую версию.',
    });
    return;
  }

  if (event.status === 'download-error') {
    updateUiState.downloading = false;
    setUpdateButtonState({ loading: false, status: 'Ошибка загрузки' });
    renderUpdatePanel({
      state: 'error',
      title: 'Не удалось скачать обновление',
      text: 'Проверьте интернет или попробуйте позже',
    });
    return;
  }

  if (event.status === 'error') {
    updateUiState.checking = false;
    updateUiState.downloading = false;
    updateUiState.lastManualCheckAt = 0;
    setUpdateButtonState({ loading: false, status: 'Проверка не удалась' });
    if (event.manual) showToast('Не удалось проверить обновления. Проверьте интернет и попробуйте позже.', 'err');
  }
}

async function loadAppVersion() {
  try {
    const info = await window.api.appInfo?.();
    if (info?.version) {
      setText('appVersionLabel', `Версия ${info.version}`);
      await maybeShowWhatsNew(info.version);
      maybeShowNewFeatureOnboarding(info.version);
    }
  } catch (error) {
    console.warn('[LightFoot] Failed to load app version', error);
  }
}

function formatDebugJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

function getDebugPanel() {
  return document.getElementById('lfDebugPanel');
}

async function reloadDebugPanel() {
  const panel = getDebugPanel();
  if (!panel) return;
  const logsBox = panel.querySelector('[data-debug-logs]');
  const diagnosticsBox = panel.querySelector('[data-debug-diagnostics]');
  if (logsBox) logsBox.textContent = 'Loading logs...';
  if (diagnosticsBox) diagnosticsBox.textContent = 'Loading diagnostics...';

  const [logsResult, diagnosticsResult] = await Promise.all([
    window.api.debugReadLogs?.({ limit: 250 }),
    window.api.debugDiagnostics?.(),
  ]);

  if (logsBox) {
    logsBox.textContent = logsResult?.ok
      ? (logsResult.logs || []).join('\n') || 'No logs yet.'
      : `Failed to read logs: ${logsResult?.error || 'unknown'}`;
  }
  if (diagnosticsBox) {
    diagnosticsBox.textContent = diagnosticsResult?.ok
      ? formatDebugJson(diagnosticsResult.diagnostics)
      : `Failed to load diagnostics: ${diagnosticsResult?.error || 'unknown'}`;
  }
}

function ensureDebugPanel() {
  if (getDebugPanel()) return;
  const panel = document.createElement('section');
  panel.id = 'lfDebugPanel';
  panel.className = 'debug-panel is-hidden';
  panel.innerHTML = `
    <div class="debug-panel-head">
      <div>
        <div class="debug-panel-title">Debug</div>
        <div class="debug-panel-subtitle">AI diagnostics, local logs, cache and memory state</div>
      </div>
      <button class="debug-panel-close" type="button" data-debug-close>Close</button>
    </div>
    <div class="debug-panel-actions">
      <button type="button" data-debug-reload>Reload diagnostics</button>
      <button type="button" data-debug-clear>Clear logs</button>
      <button type="button" data-debug-export>Export logs</button>
    </div>
    <details open>
      <summary>Diagnostics</summary>
      <pre data-debug-diagnostics>No diagnostics loaded.</pre>
    </details>
    <details open>
      <summary>Logs</summary>
      <pre data-debug-logs>No logs loaded.</pre>
    </details>
  `;
  document.body.appendChild(panel);

  panel.querySelector('[data-debug-close]')?.addEventListener('click', () => toggleDebugPanel(false));
  panel.querySelector('[data-debug-reload]')?.addEventListener('click', reloadDebugPanel);
  panel.querySelector('[data-debug-clear]')?.addEventListener('click', async () => {
    await window.api.debugClearLogs?.();
    await reloadDebugPanel();
  });
  panel.querySelector('[data-debug-export]')?.addEventListener('click', () => window.api.debugExportLogs?.());
}

async function toggleDebugPanel(force) {
  ensureDebugPanel();
  const panel = getDebugPanel();
  if (!panel) return;
  const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('is-hidden');
  panel.classList.toggle('is-hidden', !shouldOpen);
  if (shouldOpen) await reloadDebugPanel();
}

function initDebugPanelHotkey() {
  ensureDebugPanel();
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      toggleDebugPanel();
    }
  });
}

window.switchPage       = switchPage;
window.toggleTheme      = toggleTheme;
window.selectImage      = selectImage;
window.clearImage       = clearImage;
window.openWhatsApp     = openWhatsApp;
window.checkStatus      = checkStatus;
window.collectContacts  = collectContacts;
window.stopCollect      = stopCollect;
window.removeContact    = removeContact;
window.addContactToTest = addContactToTest;
window.removeDuplicates = removeDuplicates;
window.clearContacts    = clearContacts;
window.exportCsv        = exportCsv;
window.exportJson       = exportJson;
window.importCsv        = importCsv;
window.addVariant       = addVariant;
window.removeVariant    = removeVariant;
window.saveMessages     = saveMessages;
window.connectAiApiKey  = connectAiApiKey;
window.showAiKeySetup   = showAiKeySetup;
window.useAiHint        = useAiHint;
window.setAiMode        = setAiMode;
window.generateAiText   = generateAiText;
window.addAiVariantToFolder = addAiVariantToFolder;
window.showAiFeedback   = showAiFeedback;
window.saveAiFeedback   = saveAiFeedback;
window.showPreview      = showPreview;
window.startSending     = startSending;
window.stopSending      = stopSending;
window.sendTest         = sendTest;
window.clearLog         = clearLog;
window.createBase       = createBase;
window.renameBase       = renameBase;
window.deleteBase       = deleteBase;
window.createMessageFolder = createMessageFolder;
window.renameMessageFolder = renameMessageFolder;
window.deleteMessageFolder = deleteMessageFolder;
window.startOnboarding = startOnboarding;
window.checkForUpdatesManually = lfCheckForUpdatesManually;
window.selectAiManagerChat = selectAiManagerChat;
window.setAiManagerFilter = setAiManagerFilter;
window.checkAiManagerNotifications = checkAiManagerNotifications;
window.renderAiManager = renderAiManager;
window.toggleAiManagerPower = toggleAiManagerPower;
window.toggleBillzPanel = toggleBillzPanel;
window.connectBillzSecret = connectBillzSecret;
window.searchBillzProducts = searchBillzProducts;
window.copyBillzSample = copyBillzSample;
window.sendAiTest = sendAiTest;
window.clearAiSandbox = clearAiSandbox;
window.toggleDebugPanel = toggleDebugPanel;

function updateContactCountLabel({ syncDashboard = true } = {}) {
  const countEl = document.getElementById('contactCount');
  const helper = getEl('contactSearchHelper');
  const visibleCount = getFilteredContactIndices().length;
  const query = getContactSearchTerm();
  if (countEl) {
    countEl.textContent = query
      ? `${formatCountRu(visibleCount, RU_FORMS.contact)} из ${formatCountRu(contacts.length, RU_FORMS.contact)} • ${getBaseLabel(currentContactsBase)}`
      : `${formatCountRu(contacts.length, RU_FORMS.contact)} • ${getBaseLabel(currentContactsBase)}`;
  }
  if (helper) {
    helper.textContent = query
      ? (visibleCount ? `Найдено ${formatCountRu(visibleCount, RU_FORMS.contact)}` : 'Контакт не найден. Проверьте номер или имя.')
      : 'По имени, чату или номеру';
  }
  if (syncDashboard) updateDashboardSummary();
}

function formatContactMeta(contact) {
  if (!contact || !contact.source || contact.source === 'chat') return 'WhatsApp';
  if (contact.source === 'import') return 'Импорт';
  return String(contact.source);
}

function ensureCollectControls() {
  return;
}

function ensureSendBaseControl() {
  return;
}

function initDynamicBaseUi() {
  initDebugPanelHotkey();
  ensureCollectControls();
  ensureSendBaseControl();
  syncBaseSelections();
  updateBaseSummaryCards();
  updateBaseActionButtons();
  updateContactCountLabel();
  updateCollectPresetState();
  updateCollectProgress(collectSessionCurrent, collectSessionTarget || getNumericInputValue('collectTargetCount', 0));
  updateSendProgressSummary();
  updateDashboardSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDynamicBaseUi);
} else {
  initDynamicBaseUi();
}
