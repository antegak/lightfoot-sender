const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // Accounts
  accountsList:      () => ipcRenderer.invoke('accounts-list'),
  accountSetActive:  (accountId) => ipcRenderer.invoke('account-set-active', accountId),
  accountRename:     (payload) => ipcRenderer.invoke('account-rename', payload),
  accountDisconnect: (accountId) => ipcRenderer.invoke('account-disconnect', accountId),

  // WhatsApp
  waOpen:        (accountId) => ipcRenderer.invoke('wa-open', accountId),
  waStatus:      (accountId) => ipcRenderer.invoke('wa-status', accountId),
  checkStatus:   (accountId) => ipcRenderer.invoke('wa-status', accountId),
  waCollect:     (accountId, opts) => ipcRenderer.invoke('wa-collect', accountId, opts),
  waCollectStop: (accountId) => ipcRenderer.invoke('wa-collect-stop', accountId),
  waSend:        (accountId, payload) => ipcRenderer.invoke('wa-send', accountId, payload),
  waStop:        (accountId) => ipcRenderer.invoke('wa-stop', accountId),
  selectImage:   () => ipcRenderer.invoke('select-image'),

  // Contacts
  basesList:         () => ipcRenderer.invoke('bases-list'),
  baseCreate:        (name) => ipcRenderer.invoke('base-create', name),
  baseRename:        (payload) => ipcRenderer.invoke('base-rename', payload),
  baseDelete:        (baseId) => ipcRenderer.invoke('base-delete', baseId),
  contactsLoad:      (type) => ipcRenderer.invoke('contacts-load', type),
  contactsLoadInfo:  (type) => ipcRenderer.invoke('contacts-load-info', type),
  contactsSave:      (c, type) => ipcRenderer.invoke('contacts-save', c, type),
  contactsDedupe:    (type) => ipcRenderer.invoke('contacts-dedupe', type),
  contactsValidateBase: (type) => ipcRenderer.invoke('contacts-validate-base', type),
  contactsExportCsv: (c) => ipcRenderer.invoke('contacts-export-csv', c),
  contactsExportJson:(c) => ipcRenderer.invoke('contacts-export-json', c),
  contactsImportCsv: () => ipcRenderer.invoke('contacts-import-csv'),
  contactsImportConfirm: (payload) => ipcRenderer.invoke('contacts-import-confirm', payload),

  // Messages
  messagesLoad:             () => ipcRenderer.invoke('messages-load'),
  messagesSave:             (m) => ipcRenderer.invoke('messages-save', m),
  messageFolderCreate:      (name) => ipcRenderer.invoke('message-folder-create', name),
  messageFolderRename:      (payload) => ipcRenderer.invoke('message-folder-rename', payload),
  messageFolderDelete:      (folderId) => ipcRenderer.invoke('message-folder-delete', folderId),
  messageFolderActive:      (folderId) => ipcRenderer.invoke('message-folder-active', folderId),
  messageFolderImageSelect: (folderId) => ipcRenderer.invoke('message-folder-image-select', folderId),
  messageFolderImageDelete: (folderId) => ipcRenderer.invoke('message-folder-image-delete', folderId),
  openRouterGenerate:       (payload) => ipcRenderer.invoke('openrouter-generate', payload),
  aiFeedbackSave:           (payload) => ipcRenderer.invoke('ai-feedback-save', payload),
  aiConfigStatus:           () => ipcRenderer.invoke('ai-config-status'),
  aiConfigSaveKey:          (payload) => ipcRenderer.invoke('ai-config-save-key', payload),
  billzConfigStatus:        () => ipcRenderer.invoke('billz-config-status'),
  billzConfigSaveSecret:    (payload) => ipcRenderer.invoke('billz-config-save-key', payload),
  billzConfigSaveKey:       (payload) => ipcRenderer.invoke('billz-config-save-key', payload),
  billzCheckConnection:     () => ipcRenderer.invoke('billz-check-connection'),
  billzRunDiagnostics:      () => ipcRenderer.invoke('billz-run-diagnostics'),
  billzSearchProducts:      (payload) => ipcRenderer.invoke('billz-search-products', payload),
  aiTestChat:               (payload) => ipcRenderer.invoke('ai-test-chat', payload),

  // History
  historyLoad: (accountId) => ipcRenderer.invoke('history-load', accountId),

  // Utils
  openLogs:       (accountId) => ipcRenderer.invoke('open-logs', accountId),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  appInfo:        () => ipcRenderer.invoke('app-info'),
  debugReadLogs:  (payload) => ipcRenderer.invoke('debug-read-logs', payload),
  debugClearLogs: () => ipcRenderer.invoke('debug-clear-logs'),
  debugExportLogs:() => ipcRenderer.invoke('debug-export-logs'),
  debugDiagnostics: () => ipcRenderer.invoke('debug-diagnostics'),
  debugRunFixtures: () => ipcRenderer.invoke('debug-run-fixtures'),
  updatesCheck:   () => ipcRenderer.invoke('updates-check'),
  updatesDownload:() => ipcRenderer.invoke('updates-download'),
  updatesInstall: () => ipcRenderer.invoke('updates-install'),

  // Events from main process
  on: (channel, cb) => {
    const allowed = ['wa-event', 'send-progress', 'update-event'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data));
    }
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
