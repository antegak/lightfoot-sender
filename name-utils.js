(function initNameUtils(root, factory) {
  const utils = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = utils;
    return;
  }

  root.LightFootNameUtils = utils;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createNameUtils() {
  const FORBIDDEN_NAME_CHARS = '\\ / : * ? " < > |';
  const FORBIDDEN_NAME_ERROR = `В названии нельзя использовать символы: ${FORBIDDEN_NAME_CHARS}`;
  const FORBIDDEN_NAME_RE = /[\\/:*?"<>|]/;
  const WINDOWS_RESERVED_NAMES = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
  ]);

  function trimName(name) {
    return String(name || '').trim();
  }

  function getExistingName(item) {
    if (typeof item === 'string') return item;
    return item && typeof item === 'object' ? item.name : '';
  }

  function normalizeNameKey(name) {
    return trimName(name).toLocaleLowerCase('ru-RU');
  }

  function validateName(name, existingItems = [], options = {}) {
    const trimmed = trimName(name);
    const emptyMessage = options.emptyMessage || 'Введите название';
    const duplicateMessage = options.duplicateMessage || 'Название уже используется';
    const currentId = options.currentId ? String(options.currentId) : '';

    if (!trimmed) {
      return { ok: false, name: '', error: emptyMessage };
    }

    if (FORBIDDEN_NAME_RE.test(trimmed)) {
      return { ok: false, name: trimmed, error: FORBIDDEN_NAME_ERROR };
    }

    const key = normalizeNameKey(trimmed);
    const duplicate = (Array.isArray(existingItems) ? existingItems : []).some((item) => {
      if (!item) return false;
      if (currentId && typeof item === 'object' && String(item.id || '') === currentId) return false;
      return normalizeNameKey(getExistingName(item)) === key;
    });

    if (duplicate) {
      return { ok: false, name: trimmed, error: duplicateMessage };
    }

    return { ok: true, name: trimmed, error: '' };
  }

  function shortenText(value, maxLength = 80) {
    const text = String(value || '').trim();
    const limit = Math.max(12, Number(maxLength) || 80);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1).trimEnd()}…`;
  }

  function toSafeFileBaseName(name, maxLength = 120) {
    let safe = trimName(name)
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim();

    if (!safe) safe = 'База контактов';

    const reservedKey = safe.split('.')[0].toLocaleLowerCase('en-US');
    if (WINDOWS_RESERVED_NAMES.has(reservedKey)) {
      safe = `${safe} файл`;
    }

    return shortenText(safe, maxLength).replace(/[. ]+$/g, '').trim() || 'База контактов';
  }

  function makeCopyName(baseName, copyIndex) {
    return `${baseName} — копия ${copyIndex}`;
  }

  return {
    FORBIDDEN_NAME_CHARS,
    FORBIDDEN_NAME_ERROR,
    FORBIDDEN_NAME_RE,
    trimName,
    validateName,
    shortenText,
    toSafeFileBaseName,
    makeCopyName,
  };
});
