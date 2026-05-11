const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { logger, LOG_CATEGORIES } = require('./services/logger/logger');

const CHROMIUM_RELATIVE_PATH = path.join('chromium', 'chrome-win', 'chrome.exe');

function getBundledChromiumCandidates() {
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, CHROMIUM_RELATIVE_PATH));
  }

  candidates.push(path.join(__dirname, CHROMIUM_RELATIVE_PATH));
  candidates.push(path.join(process.cwd(), CHROMIUM_RELATIVE_PATH));

  return Array.from(new Set(candidates));
}

function resolveBundledChromiumPath() {
  for (const candidate of getBundledChromiumCandidates()) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  return null;
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// SELECTORS (with fallbacks for both WA and WA Business)
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const SEL = {
  chatList:  ['[data-testid="chat-list"]', '#pane-side'],
  chatItem:  ['[data-testid="cell-frame-container"]', '#pane-side > div > div > div > div'],
  // Date/time is in the TOP-RIGHT of each chat row.
  // Primary: cell-frame-secondary contains the timestamp span (right-aligned).
  // Fallback: gridcell last span (WhatsApp's internal grid layout).
  chatTime:  [
    '[data-testid="cell-frame-secondary"] span',
    'div[role="gridcell"]:last-child span',
    'div[role="gridcell"] span:last-child',
  ],
  chatName:  ['[data-testid="cell-frame-title"] span', 'span[title]'],
  groupIcon: ['[data-testid="default-group"]', '[data-icon="default-group"]'],
  sidePanel: ['#side', '[data-testid="chatlist-header"]', '[data-testid="chat-list"]'],

  header: ['[data-testid="conversation-header"]'],

  // Clickable profile element вЂ” ONLY role=button inside header.
  // This avoids the "Add label" button trap in WhatsApp Business.
  // We click the FIRST role=button in the header, which is always the contact name/avatar.
  headerProfileBtn: [
    '[data-testid="conversation-header"] [role="button"]:first-of-type',
    '[data-testid="conversation-header"] header > [role="button"]',
    '[data-testid="conversation-header"] [data-testid="conversation-info-header-chat-title"]',
  ],

  // Header title span вЂ” may already contain phone (Business: no name saved)
  headerTitle: [
    '[data-testid="conversation-info-header-chat-title"] span',
    '[data-testid="conversation-header"] [role="button"] span[dir="auto"]',
    '[data-testid="conversation-header"] span[dir="auto"]',
  ],

  // Profile drawer
  drawer:      ['[data-testid="drawer-right"]', '[data-testid="contact-info"]'],
  drawerClose: ['[data-testid="btn-close-drawer"]', '[data-testid="x-btn"]'],

  // Targeted phone selectors inside drawer (most specific first)
  drawerPhone: [
    '[data-testid="drawer-right"] [data-testid="phone"] span',
    '[data-testid="drawer-right"] span[dir="ltr"]',
    '[data-testid="drawer-right"] span',
    '[data-testid="contact-info"] span[dir="ltr"]',
    '[data-testid="contact-info"] span',
  ],

  composeBox: [
    '[data-testid="conversation-compose-box-input"]',
    'div[contenteditable="true"][data-tab]',
  ],
};

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// HELPERS
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function findFirst(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) return el;
    } catch {}
  }
  return null;
}

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (/^0\d{9,}$/.test(digits)) digits = `996${digits.slice(1, 10)}`;
  if (/^996\d{9,}$/.test(digits)) digits = digits.slice(0, 12);
  if (!/^\d{10,15}$/.test(digits)) return null;
  return digits;
}

function normalizePhoneKey(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (/^0\d{9,}$/.test(digits)) return `996${digits.slice(1, 10)}`;
  if (/^996\d{9,}$/.test(digits)) return digits.slice(0, 12);
  return digits;
}

function normalizeName(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU');
}

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// CONTROLLER
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
class WhatsAppController {
  constructor(sessionDir, emit, meta = {}) {
    this.sessionDir = sessionDir;
    this.emit = emit;             // (channel, data) => void
    this.accountId = String(meta?.accountId || '');
    this.browser = null;
    this.page = null;
    this.browserPath = null;
    this.stopFlag = false;         // sendMessages abort
    this.collectStopFlag = false;  // collectContacts abort
    this.collectInProgress = false;
    this.collectStoppedEmitted = false;
    this.connectionWatchTimer = null;
  }

  // в”Ђв”Ђ Launch в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  async launch() {
    if (this.browser) return;

    this.browserPath = resolveBundledChromiumPath();
    if (!this.browserPath) {
      const expectedPath = path.join(process.resourcesPath || '<resources>', CHROMIUM_RELATIVE_PATH);
      throw new Error(
        `Встроенный Chromium не найден. Ожидаемый путь: ${expectedPath}. ` +
        'Переустановите приложение или пересоберите его с папкой chromium/chrome-win.'
      );
    }

    try {
      this.browser = await chromium.launchPersistentContext(this.sessionDir, {
        headless: false,
        executablePath: this.browserPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--blink-settings=imagesEnabled=false',
        ],
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      this.browser.on('page', async (page) => {
        await page.route('**/*.{mp4,mp3,wav,ogg,webm}', r => r.abort()).catch(() => {});
      });

      const pages = this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
      await this.page.route('**/*.{mp4,mp3,wav,ogg,webm}', r => r.abort()).catch(() => {});

      await this.page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      this.emit('wa-event', { type: 'opened' });
      this._watchConnection();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  // в”Ђв”Ђ Connection watcher в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  async _watchConnection() {
    this._clearConnectionWatchTimer();
    let attempts = 0;
    const check = async () => {
      if (!this.page) return;
      try {
        if (await this.isConnected()) { this.emit('wa-event', { type: 'connected' }); return; }
        if (++attempts < 150) this.connectionWatchTimer = setTimeout(check, 2000);
        else this.emit('wa-event', { type: 'timeout' });
      } catch {
        this.connectionWatchTimer = setTimeout(check, 3000);
      }
    };
    this.connectionWatchTimer = setTimeout(check, 3000);
  }

  _clearConnectionWatchTimer() {
    if (this.connectionWatchTimer) {
      clearTimeout(this.connectionWatchTimer);
      this.connectionWatchTimer = null;
    }
  }

  async checkStatus() {
    try {
      if (!this.page || this.page.isClosed?.()) return 'loading';

      const isConnected = await this.page.$('#side');
      if (isConnected) return 'connected';

      const qr = await this.page.$('canvas');
      if (qr) return 'qr';

      return 'loading';
    } catch {
      return 'error';
    }
  }

  // в”Ђв”Ђ isConnected в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  async isConnected() {
    return (await this.checkStatus()) === 'connected';
  }

  // Returns array of contact objects:
  //   { name, phone, source }
  async collectContacts(opts = {}) {
    const { targetCount = 50, onContactFound, onProgress, initialStats = {} } = opts;
    const limit = Math.max(1, parseInt(targetCount, 10) || 1);
    this.collectStopFlag = false;
    this.stopFlag = false;
    this.collectInProgress = true;
    this.collectStoppedEmitted = false;

    const contacts = [];
    const processedRawChatKeys = new Set();
    const processedChatKeys = new Set();
    const processedPhoneKeys = new Set();
    let totalChats = 0;
    let skippedArchived = 0;
    let skippedNoPhone = 0;
    let skippedDuplicates = 0;
    let errors = 0;
    let collectDoneEmitted = false;
    let noNewCount = 0;
    let lastSeenPhone = '';
    let lastSeenName = '';
    let lastNewAt = Date.now();
    const noNewRoundsLimit = 10;
    const buildStats = () => ({
      ...(initialStats && typeof initialStats === 'object' ? initialStats : {}),
      totalChats,
      found: processedPhoneKeys.size,
      added: contacts.length,
      targetCount: limit,
      skippedArchived,
      skippedNoPhone,
      skippedDuplicates,
      errors,
      noNewCount,
      lastSeenPhone,
      lastSeenName,
      lastParsedPhone: lastSeenPhone,
      lastParsedName: lastSeenName,
    });

    try {
      this.emit('wa-event', { type: 'collecting', message: 'Загружаем список чатов...' });

      let chatListEl = await findFirst(this.page, SEL.chatList);
      if (!chatListEl) throw new Error('Список чатов не найден. Убедитесь, что WhatsApp подключён.');

      try { await chatListEl.evaluate(el => { el.scrollTop = 0; }); } catch {}
      await this._sleepCollect(250);

      this.emit('wa-event', {
        type: 'collecting',
        message: 'Проходим список чатов сверху вниз без повторов...',
      });

      while (!this._shouldStopCollect()) {
        if (contacts.length >= limit) break;

        chatListEl = await findFirst(this.page, SEL.chatList);
        if (!chatListEl) break;

        const chatItems = await this._getVisibleChatItems();
        if (!chatItems.length) {
          const scrolled = await this._scrollChatListStep(chatListEl);
          if (!scrolled) break;
          await this._sleepCollect(this._randomBetween(500, 1000));
          continue;
        }

        let processedThisRound = 0;
        let newContactsThisRound = 0;

        for (const item of chatItems) {
          if (this._shouldStopCollect()) break;
          if (contacts.length >= limit) break;

          try {
            const meta = await this._readChatItemMeta(item);
            const normalizedName = normalizeName(meta.name);
            const fallbackKey = meta.key || (normalizedName ? `name:${normalizedName}` : `index:${processedRawChatKeys.size}`);
            if (processedRawChatKeys.has(fallbackKey)) continue;

            processedRawChatKeys.add(fallbackKey);
            totalChats = processedRawChatKeys.size;
            processedThisRound++;

            if (typeof onProgress === 'function') {
              try {
                onProgress({
                  type: 'chat',
                  chatKey: fallbackKey,
                  lastSeenName: meta.name,
                  lastParsedName: meta.name,
                });
              } catch {}
            }

            if (meta.isGroup) continue;
            if (meta.isArchived) {
              skippedArchived++;
              continue;
            }
            if (this._shouldStopCollect()) break;

            const phone = await this._openChatAndExtractPhone(item);
            if (!phone) {
              skippedNoPhone++;
              continue;
            }
            const normalizedPhone = normalizePhoneKey(phone);
            if (!normalizedPhone) {
              skippedNoPhone++;
              continue;
            }
            const chatKey = `phone:${normalizedPhone}`;
            if (processedChatKeys.has(chatKey)) {
              skippedDuplicates++;
              if (typeof onProgress === 'function') {
                try {
                  onProgress({
                    type: 'duplicate',
                    reason: 'session-chat',
                    phone,
                    lastSeenPhone: phone,
                    lastSeenName: meta.name,
                    lastParsedPhone: phone,
                    lastParsedName: meta.name,
                    chatKey,
                  });
                } catch {}
              }
              continue;
            }
            processedChatKeys.add(chatKey);
            if (processedPhoneKeys.has(normalizedPhone)) {
              skippedDuplicates++;
              if (typeof onProgress === 'function') {
                try {
                  onProgress({
                    type: 'duplicate',
                    reason: 'session-phone',
                    phone,
                    lastSeenPhone: phone,
                    lastSeenName: meta.name,
                    lastParsedPhone: phone,
                    lastParsedName: meta.name,
                    chatKey,
                  });
                } catch {}
              }
              continue;
            }
            processedPhoneKeys.add(normalizedPhone);
            lastSeenPhone = phone;
            lastSeenName = meta.name || phone;
            if (typeof onProgress === 'function') {
              try {
                onProgress({
                  type: 'seen',
                  phone,
                  lastSeenPhone: phone,
                  lastSeenName,
                  lastParsedPhone: phone,
                  lastParsedName: lastSeenName,
                  chatKey,
                });
              } catch {}
            }

            const contact = {
              name: meta.name || phone,
              phone,
              source: meta.source || 'chat',
            };
            let addResult = { added: true, contact };
            if (typeof onContactFound === 'function') {
              try {
                addResult = await Promise.resolve(onContactFound(contact)) || addResult;
              } catch {
                errors++;
                if (typeof onProgress === 'function') {
                  try { onProgress({ type: 'error' }); } catch {}
                }
                continue;
              }
            }
            if (addResult?.added === false) {
              if (String(addResult.reason || '').includes('duplicate')) skippedDuplicates++;
              continue;
            }

            const storedContact = addResult?.contact || contact;
            contacts.push(storedContact);
            newContactsThisRound++;
            lastNewAt = Date.now();
            logger.info(LOG_CATEGORIES.WHATSAPP, 'contact collected', {
              phone,
              total: contacts.length,
            });

            this.emit('wa-event', {
              type: 'progress',
              contact: storedContact,
              total: contacts.length,
              current: contacts.length,
              target: limit,
              lastSeenPhone: phone,
              lastSeenName,
              lastParsedPhone: phone,
              lastParsedName: lastSeenName,
              message: `Найден: ${storedContact.name}`,
              count: contacts.length,
              stats: buildStats(),
            });

            if (contacts.length % 10 === 0 && contacts.length < limit) {
              await this._sleepCollect(this._randomBetween(3000, 5000));
            } else {
              await this._sleepCollect(this._randomBetween(800, 2000));
            }
          } catch {
            errors++;
            if (typeof onProgress === 'function') {
              try { onProgress({ type: 'error' }); } catch {}
            }
            // One broken chat must not stop the whole process.
          }
        }

        if (this._shouldStopCollect()) break;
        if (contacts.length >= limit) break;

        this.emit('wa-event', {
          type: 'collecting',
          message: `Сканируем чаты: ${totalChats}. Контактов: ${contacts.length}/${limit}`,
          stats: buildStats(),
        });

        if (newContactsThisRound === 0) {
          noNewCount++;
        } else {
          noNewCount = 0;
        }
        if (noNewCount >= noNewRoundsLimit && Date.now() - lastNewAt >= 30000) break;

        const scrolled = await this._scrollChatListStep(chatListEl);
        if (!scrolled && processedThisRound === 0) break;
        if (this._shouldStopCollect()) break;
        if (scrolled) await this._sleepCollect(this._randomBetween(500, 1000));
      }

      const stopped = this._shouldStopCollect();
      if (stopped) {
        this._emitCollectStopped();
      } else if (!collectDoneEmitted) {
        collectDoneEmitted = true;
        this.emit('wa-event', {
          type: 'collect-done',
          count: contacts.length,
          stats: buildStats(),
        });
      }

      return { contacts, stopped };
    } finally {
      this.collectInProgress = false;
      this.collectStopFlag = false;
      this.stopFlag = false;
    }
  }

  _shouldStopCollect() {
    return this.collectStopFlag || this.stopFlag;
  }

  _emitCollectStopped() {
    if (this.collectStoppedEmitted) return;
    this.collectStoppedEmitted = true;
    this.emit('wa-event', { type: 'stopped' });
  }

  async _getVisibleChatItems() {
    for (const sel of SEL.chatItem) {
      try {
        const items = await this.page.$$(sel);
        if (items.length > 0) return items;
      } catch {}
    }
    return [];
  }

  async _readChatItemMeta(item) {
    const [key, isGroup, isArchived, name] = await Promise.all([
      this._getChatItemKey(item),
      this._isGroupChatItem(item),
      this._isArchivedChatItem(item),
      this._extractNameFromItem(item),
    ]);

    return {
      key,
      isGroup,
      isArchived,
      source: 'chat',
      name: name.trim(),
    };
  }

  async _getChatItemKey(item) {
    try {
      return await item.evaluate((el) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const parts = [];
        const add = (value, prefix = '') => {
          const text = normalize(value);
          if (text) parts.push(prefix + text);
        };

        add(el.getAttribute('data-id'), 'id:');
        add(el.getAttribute('aria-label'), 'aria:');
        add(el.getAttribute('data-testid'), 'testid:');

        for (const node of Array.from(el.querySelectorAll('[title]')).slice(0, 3)) {
          add(node.getAttribute('title'), 'title:');
        }

        const textLines = (el.innerText || '')
          .split('\n')
          .map(normalize)
          .filter(Boolean)
          .slice(0, 4)
          .join(' | ');
        add(textLines, 'text:');

        const unique = Array.from(new Set(parts));
        return unique.join(' || ').slice(0, 240);
      });
    } catch {
      return null;
    }
  }

  async _isGroupChatItem(item) {
    try {
      for (const sel of SEL.groupIcon) {
        if (await item.$(sel).catch(() => null)) return true;
      }
    } catch {}
    return false;
  }

  async _isArchivedChatItem(item) {
    try {
      return await item.evaluate((el) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const archivedExact = new Set(['archived', 'в архиве']);
        const archivedPartial = ['archive', 'archived', 'архив', 'в архиве'];

        const lines = (el.innerText || '')
          .split('\n')
          .map(normalize)
          .filter(Boolean);
        if (lines.some(line => archivedExact.has(line))) return true;

        const titles = Array.from(el.querySelectorAll('[title]'))
          .map(node => normalize(node.getAttribute('title')))
          .filter(Boolean);
        if (titles.some(title => archivedExact.has(title))) return true;

        return [el, ...el.querySelectorAll('[aria-label],[data-testid]')].some((node) => {
          const aria = normalize(node.getAttribute('aria-label'));
          const testid = normalize(node.getAttribute('data-testid'));
          return archivedPartial.some((word) => aria.includes(word) || testid.includes(word));
        });
      });
    } catch {
      return false;
    }
  }

  async _extractNameFromItem(item) {
    for (const sel of SEL.chatName) {
      try {
        const el = await item.$(sel);
        if (!el) continue;
        const text = (await el.textContent().catch(() => '')) || '';
        if (text.trim()) return text;
      } catch {}
    }

    try {
      return await item.evaluate((el) => {
        const titleNode = el.querySelector('[title]');
        return titleNode ? (titleNode.getAttribute('title') || '').trim() : '';
      });
    } catch {
      return '';
    }
  }

  async _openChatAndExtractPhone(item) {
    if (this._shouldStopCollect()) return null;

    try { await item.scrollIntoViewIfNeeded().catch(() => {}); } catch {}

    const clicked = await item.click({ timeout: 2000 }).then(() => true).catch(async () => {
      try {
        await item.evaluate(el => el.click());
        return true;
      } catch {
        return false;
      }
    });
    if (!clicked) return null;

    await this._sleepCollect(250);
    if (this._shouldStopCollect()) return null;

    return this._extractPhoneFromChat();
  }

  async _getChatListMetrics(chatListEl) {
    try {
      return await chatListEl.evaluate((el) => ({
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }));
    } catch {
      return { scrollTop: 0, clientHeight: 0, scrollHeight: 0 };
    }
  }

  async _scrollChatListStep(chatListEl) {
    if (!chatListEl || this._shouldStopCollect()) return false;

    try {
      const before = await this._getChatListMetrics(chatListEl);
      const step = 800;
      const maxTop = Math.max(before.scrollHeight - before.clientHeight, 0);
      const nextTop = Math.min(before.scrollTop + step, maxTop);
      if (nextTop <= before.scrollTop) return false;

      await chatListEl.evaluate((el, top) => { el.scrollTop = top; }, nextTop);
      await this._sleepCollect(180);

      const after = await this._getChatListMetrics(chatListEl);
      return after.scrollTop > before.scrollTop;
    } catch {
      return false;
    }
  }

  async _waitForAnySelector(selectors, timeout = 1000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
      if (this._shouldStopCollect()) return null;

      for (const sel of selectors) {
        try {
          const el = await this.page.$(sel);
          if (el) return el;
        } catch {}
      }

      await this._sleep(100);
    }

    return null;
  }

  // в”Ђв”Ђ Stop collect (instant) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  stopCollect() {
    this.collectStopFlag = true;
    this.stopFlag = true;
    if (this.collectInProgress) this._emitCollectStopped();
  }

  // ── Extract phone from currently open chat ────────────────────
  // Supports both regular WhatsApp and WhatsApp Business.
  //
  // Strategy order:
  //   1. Read header title — may already BE a phone (Business: no saved name)
  //   2. Click the first [role="button"] inside header (avoids "Add label" trap)
  //   3. Scan profile drawer for phone-shaped text
  //   4. Full-page scan as last resort
  //
  // Always closes drawer via Escape. Never throws — returns null on failure.
  async _extractPhoneFromChat() {
    try {
      if (this._shouldStopCollect()) return null;

      // ── Strategy 1: header title might already contain a phone ──
      for (const sel of SEL.headerTitle) {
        try {
          const el = await this.page.$(sel);
          if (!el) continue;
          const text = await el.textContent().catch(() => '') || '';
          const phone = normalizePhone(text);
          if (phone) return phone;
        } catch {}
      }
      if (this._shouldStopCollect()) return null;

      // ── Strategy 2: click the profile button inside header ──
      let clicked = false;
      for (const sel of SEL.headerProfileBtn) {
        try {
          const el = await this.page.$(sel);
          if (!el) continue;
          await el.click();
          clicked = true;
          break;
        } catch {}
      }

      if (!clicked) {
        try {
          const header = await findFirst(this.page, SEL.header);
          if (header) await header.click();
        } catch {}
      }
      if (this._shouldStopCollect()) return null;

      await this._waitForAnySelector(SEL.drawer, 900);
      if (this._shouldStopCollect()) {
        await this._closeDrawer().catch(() => {});
        return null;
      }

      // ── Strategy 3: scan profile drawer ──
      const phoneFromDrawer = await this._scanDrawerForPhone();
      if (phoneFromDrawer) {
        await this._closeDrawer();
        return phoneFromDrawer;
      }

      // ── Strategy 4: full-page scan ──
      const phoneFromPage = await this._scanPageForPhone();
      await this._closeDrawer();
      return phoneFromPage;

    } catch {
      await this._closeDrawer().catch(() => {});
      return null;
    }
  }

  // Targeted drawer scan (most-specific selectors first)
  async _scanDrawerForPhone() {
    // Try targeted selectors first
    for (const sel of SEL.drawerPhone) {
      try {
        const els = await this.page.$$(sel);
        for (const el of els) {
          const text = await el.textContent().catch(() => '') || '';
          const phone = normalizePhone(text);
          if (phone) return phone;
        }
      } catch {}
    }

    // Generic drawer container scan
    try {
      const drawer = await findFirst(this.page, SEL.drawer);
      if (drawer) {
        const spans = await drawer.$$('span, div').catch(() => []);
        for (const el of spans) {
          const text = await el.textContent().catch(() => '') || '';
          // Only check short strings that look like standalone phone numbers
          if (text.trim().length <= 20) {
            const phone = normalizePhone(text);
            if (phone) return phone;
          }
        }
      }
    } catch {}

    return null;
  }

  // Full-page scan вЂ” last resort, avoids false positives by checking text length
  async _scanPageForPhone() {
    try {
      const result = await this.page.evaluate(() => {
        for (const el of document.querySelectorAll('span')) {
          const t = (el.textContent || '').trim();
          if (t.length > 20) continue; // skip long strings
          const c = t.replace(/[^\d+]/g, '');
          if (/^\+?\d{10,15}$/.test(c)) return c;
        }
        return null;
      });
      if (!result) return null;
      return result.startsWith('+') ? result : '+' + result;
    } catch { return null; }
  }

  async _closeDrawer() {
    try {
      for (const sel of SEL.drawerClose) {
        const btn = await this.page.$(sel);
        if (btn) { await btn.click(); await this._sleep(120); return; }
      }
      await this.page.keyboard.press('Escape');
      await this._sleep(120);
    } catch {}
  }

  // ── Send messages ──────────────────────────────────────────────
  async sendMessages({ contacts, messages, opts, history, onProgress, onLog }) {
    const {
      count = 20, delayMin = 60, delayMax = 120,
      safeMode = true, skipSentWithinDays = 0, testMode = false,
      repeatMode = 'skip-ever',
      imagePath = null, // optional: absolute path to image file
    } = opts;

    this.stopFlag = false;
    let sent = 0, errors = 0, skipped = 0, consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 4;
    const shouldSkipByHistory = (phone) => {
      if (testMode || repeatMode === 'allow') return false;
      const historyKey = normalizePhoneKey(phone);
      const record = historyKey ? history[historyKey] : null;
      if (!record) return false;
      if (repeatMode === 'skip-days') {
        const lastSent = Number(record.lastSent || 0);
        if (!lastSent || skipSentWithinDays <= 0) return false;
        return (Date.now() - lastSent) / 86400000 < skipSentWithinDays;
      }
      return true;
    };
    const targets = [];
    for (const contact of contacts) {
      if (targets.length >= count) break;
      if (shouldSkipByHistory(contact?.phone)) {
        skipped++;
        onLog(`ПРОПУСК: уже отправляли ${contact.phone}`);
        continue;
      }
      targets.push(contact);
    }
    const total = targets.length;
    const validMessages = messages.filter(m => m && m.trim());

    if (!validMessages.length) {
      onLog('РћРЁРР‘РљРђ: РЅРµС‚ С‚РµРєСЃС‚Р°');
      return { ok: false, sent: 0, errors: 0, skipped: 0, error: 'Нет текста для отправки' };
    }

    for (let i = 0; i < targets.length; i++) {
      if (this.stopFlag) { onLog('РћРЎРўРђРќРћР’Р›Р•РќРћ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј'); break; }
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        onLog(`РђР’РўРћ-РЎРўРћРџ: ${consecutiveErrors} РѕС€РёР±РѕРє РїРѕРґСЂСЏРґ`);
        onProgress({ type: 'auto-stop', sent, errors, remaining: total - i });
        break;
      }

      const contact = targets[i];
      const phone = contact.phone;
      if (this.stopFlag) break;

      const message = validMessages[Math.floor(Math.random() * validMessages.length)];

      let success = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try { await this._sendToPhone(phone, message, safeMode, imagePath); success = true; break; }
        catch (e) {
          if (this.stopFlag || e?.message === 'stopped') break;
          onLog(`РћРЁРР‘РљРђ (РїРѕРїС‹С‚РєР° ${attempt}): ${phone} вЂ” ${e.message}`);
          if (attempt < 2) await this._sleep(3000);
        }
      }

      if (this.stopFlag) break;

      if (success) {
        sent++; consecutiveErrors = 0;
        onLog(`РћРўРџР РђР’Р›Р•РќРћ: ${phone}`);
        onProgress({ type: 'sent', phone, name: contact.name, sent, errors, remaining: total - i - 1 });
      } else {
        errors++; consecutiveErrors++;
        onProgress({ type: 'error', phone, sent, errors, remaining: total - i - 1 });
      }

      if (sent > 0 && sent % 10 === 0 && i < targets.length - 1) {
        const mins = safeMode ? 4 : 3;
        const pauseMs = (mins * 60 + Math.floor(Math.random() * 60)) * 1000;
        onLog(`РџРђРЈР—Рђ: ${mins} РјРёРЅ`);
        onProgress({ type: 'pause', message: `РџР°СѓР·Р° ${mins} РјРёРЅ...`, sent, errors, remaining: total - i - 1 });
        await this._sleepInterruptible(pauseMs);
      }

      if (i < targets.length - 1) {
        const delayMs = (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
        onProgress({ type: 'waiting', delay: Math.round(delayMs / 1000), sent, errors, remaining: total - i - 1 });
        await this._sleepInterruptible(delayMs);
      }
    }

    onLog(`Р—РђР’Р•Р РЁР•РќРћ: РѕС‚РїСЂР°РІР»РµРЅРѕ ${sent}, РѕС€РёР±РѕРє ${errors}, РїСЂРѕРїСѓС‰РµРЅРѕ ${skipped}`);
    return { ok: true, sent, errors, skipped };
  }

  async _sendToPhone(phone, message, safeMode, imagePath = null) {
    if (this.stopFlag) throw new Error('stopped');
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    await this.page.goto(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=`, {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    if (this.stopFlag) throw new Error('stopped');

    let inputEl = null;
    for (const sel of SEL.composeBox) {
      try {
        await this.page.waitForSelector(sel, { timeout: 15000 });
        inputEl = await this.page.$(sel);
        if (inputEl) break;
      } catch {}
    }

    if (!inputEl) {
      const invalid = await this.page.$('[data-testid="confirm-popup"]').catch(() => null);
      throw new Error(invalid ? 'РќРѕРјРµСЂ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ' : 'РџРѕР»Рµ РІРІРѕРґР° РЅРµ РЅР°Р№РґРµРЅРѕ');
    }

    if (this.stopFlag) throw new Error('stopped');
    await this._sleep(500);
    if (this.stopFlag) throw new Error('stopped');

    // в”Ђв”Ђ Image sending path в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    if (imagePath) {
      await this._sendWithImage(inputEl, message, imagePath, safeMode);
    } else {
      // в”Ђв”Ђ Text-only path в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
      await inputEl.click();
      await this._sleep(300);

      if (safeMode) {
        await this._humanType(inputEl, message);
      } else {
        await inputEl.fill(message).catch(() => this.page.keyboard.type(message));
      }

      if (this.stopFlag) throw new Error('stopped');
      await this._sleep(500 + Math.random() * 800);
      if (this.stopFlag) throw new Error('stopped');
      await this.page.keyboard.press('Enter');
      await this._sleep(800);
    }

    if (this.stopFlag) throw new Error('stopped');
    await this.page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await this._sleep(500);
  }

  // в”Ђв”Ђ Send image (+ optional caption) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  async _sendWithImage(inputEl, caption, imagePath, safeMode) {
    if (this.stopFlag) throw new Error('stopped');
    // Click the attachment (paperclip) button
    const clipSelectors = [
      '[data-testid="attachment-menu-plus"]',
      '[data-testid="clip"]',
      'span[data-icon="plus"]',
      'span[data-icon="attach-menu-plus"]',
      '[title="РџСЂРёРєСЂРµРїРёС‚СЊ"]',
      '[aria-label="РџСЂРёРєСЂРµРїРёС‚СЊ"]',
    ];

    let clipBtn = null;
    for (const sel of clipSelectors) {
      clipBtn = await this.page.$(sel).catch(() => null);
      if (clipBtn) break;
    }

    if (!clipBtn) {
      // Fallback: try text-only if we can't find attachment button
      logger.warn(LOG_CATEGORIES.WHATSAPP, 'image attach button not found, falling back to text-only');
      await inputEl.click();
      await this._sleep(300);
      if (safeMode) { await this._humanType(inputEl, caption); }
      else { await inputEl.fill(caption).catch(() => this.page.keyboard.type(caption)); }
      await this._sleep(400);
      if (this.stopFlag) throw new Error('stopped');
      await this.page.keyboard.press('Enter');
      await this._sleep(800);
      return;
    }

    await clipBtn.click();
    await this._sleep(600);
    if (this.stopFlag) throw new Error('stopped');

    // Find the "Photos & Videos" or generic file input
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ];

    let fileInput = null;
    for (const sel of fileInputSelectors) {
      fileInput = await this.page.$(sel).catch(() => null);
      if (fileInput) break;
    }

    if (!fileInput) {
      // Try clicking "Photo or Video" menu item first
      const photoMenuSelectors = [
        '[data-testid="mi-attach-image"]',
        '[aria-label="Photos & Videos"]',
        '[aria-label="Р¤РѕС‚Рѕ Рё РІРёРґРµРѕ"]',
        'li[data-testid="media"]',
      ];
      for (const sel of photoMenuSelectors) {
        const menuItem = await this.page.$(sel).catch(() => null);
        if (menuItem) { await menuItem.click(); await this._sleep(500); break; }
      }
      // Try file input again after menu click
      for (const sel of fileInputSelectors) {
        fileInput = await this.page.$(sel).catch(() => null);
        if (fileInput) break;
      }
    }

    if (!fileInput) {
      throw new Error('РќРµ РЅР°Р№РґРµРЅРѕ РїРѕР»Рµ РґР»СЏ Р·Р°РіСЂСѓР·РєРё РёР·РѕР±СЂР°Р¶РµРЅРёСЏ');
    }

    // Upload the file
    await fileInput.setInputFiles(imagePath);
    await this._sleep(1500); // wait for preview to load
    if (this.stopFlag) throw new Error('stopped');

    // Type caption into the caption field (appears after image preview)
    if (caption && caption.trim()) {
      const captionSelectors = [
        '[data-testid="media-caption-input"]',
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][data-lexical-editor="true"]',
      ];
      let captionEl = null;
      for (const sel of captionSelectors) {
        captionEl = await this.page.$(sel).catch(() => null);
        if (captionEl) break;
      }
      if (captionEl) {
        await captionEl.click();
        await this._sleep(200);
        if (safeMode) { await this._humanType(captionEl, caption); }
        else { await captionEl.fill(caption).catch(() => this.page.keyboard.type(caption)); }
        await this._sleep(400);
        if (this.stopFlag) throw new Error('stopped');
      }
    }

    // Send button for media
    const sendBtnSelectors = [
      '[data-testid="send"]',
      'span[data-icon="send"]',
      '[aria-label="РћС‚РїСЂР°РІРёС‚СЊ"]',
      '[aria-label="Send"]',
    ];
    let sendBtn = null;
    for (const sel of sendBtnSelectors) {
      sendBtn = await this.page.$(sel).catch(() => null);
      if (sendBtn) break;
    }

    if (sendBtn) {
      await sendBtn.click();
    } else {
      await this.page.keyboard.press('Enter');
    }
    await this._sleep(1200);
  }

  async _humanType(el, text) {
    for (const char of text) {
      if (char === '\n') {
        await this.page.keyboard.down('Shift');
        await this.page.keyboard.press('Enter');
        await this.page.keyboard.up('Shift');
        continue;
      }

      await el.type(char, { delay: 30 + Math.random() * 70 });
      if (Math.random() < 0.04) await this._sleep(200 + Math.random() * 300);
    }
  }

  _randomBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async _sleepCollect(ms) {
    const tick = 100;
    let elapsed = 0;

    while (elapsed < ms) {
      if (this._shouldStopCollect()) return false;
      await this._sleep(Math.min(tick, ms - elapsed));
      elapsed += tick;
    }

    return !this._shouldStopCollect();
  }

  async _sleepInterruptible(ms) {
    const tick = 200;
    let elapsed = 0;
    while (elapsed < ms) {
      if (this.stopFlag) return;
      await this._sleep(Math.min(tick, ms - elapsed));
      elapsed += tick;
    }
  }

  async close() {
    this._clearConnectionWatchTimer();
    try { if (this.browser) await this.browser.close(); } catch {}
    this.browser = null;
    this.page = null;
    this.browserPath = null;
  }
}

module.exports = { WhatsAppController };
