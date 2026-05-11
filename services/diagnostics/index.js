const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function getDiagnosticsConfig() {
  return readJsonSafe(path.join(__dirname, '..', '..', 'config', 'diagnostics-config.json'), {
    enabled: true,
    checks: {},
  });
}

function status(ok, meta = {}) {
  return { ok: Boolean(ok), ...meta };
}

async function buildDiagnostics(context = {}) {
  const config = getDiagnosticsConfig();
  const checks = config.checks || {};
  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    checks: {},
    state: {},
  };

  if (checks.billzConnected !== false) {
    const billzStatus = context.getBillzStatus?.() || {};
    result.checks.billzConnected = status(Boolean(billzStatus.connected), {
      status: billzStatus.status || 'unknown',
      error: billzStatus.error || '',
      lastCheckedAt: billzStatus.lastCheckedAt || '',
    });
  }

  if (checks.openRouterConnected !== false) {
    const connected = Boolean(context.hasOpenRouterApiKey?.());
    result.checks.openRouterConnected = status(connected);
  }

  if (checks.cacheLoaded !== false) {
    const cacheState = context.getCacheState?.() || {};
    result.checks.cacheLoaded = status(Boolean(cacheState.loaded || cacheState.billzDiagnosticsAvailable), cacheState);
  }

  if (checks.aiMemoryActive !== false) {
    const memory = context.getAiMemory?.() || {};
    const active = Object.values(memory).some((value) => Boolean(value));
    result.checks.aiMemoryActive = status(active, { memory });
  }

  if (checks.whatsAppSessionActive !== false) {
    const sessions = context.getWhatsAppSessionState?.() || {};
    result.checks.whatsAppSessionActive = status(Boolean(sessions.activeCount), sessions);
  }

  result.ok = Object.values(result.checks).every((check) => check.ok || check.status === 'disconnected');
  result.state = {
    featureFlags: context.getFeatureFlags?.() || {},
    logDirectory: context.getLogDirectory?.() || '',
  };
  return result;
}

module.exports = { buildDiagnostics };
