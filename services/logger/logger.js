const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { LOG_CATEGORIES } = require('./categories');
const { createTransports, getLogDirectory, getLoggingConfig } = require('./transports');

const safeFormat = winston.format.printf((info) => {
  const { timestamp, level, message, ...meta } = info;
  const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${message}${metaText}`;
});

function createSafeLogger() {
  try {
    return winston.createLogger({
      level: getLoggingConfig().level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        safeFormat
      ),
      transports: createTransports(),
      exitOnError: false,
    });
  } catch {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
  }
}

const winstonLogger = createSafeLogger();

function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(meta, (_key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack, code: value.code };
      }
      return value;
    }));
  } catch {
    return { meta: '[unserializable]' };
  }
}

function write(level, category, message, meta) {
  try {
    const normalizedCategory = String(category || LOG_CATEGORIES.SYSTEM).toUpperCase();
    winstonLogger[level](`[${normalizedCategory}] ${message}`, normalizeMeta(meta));
  } catch {
    // Logging must never crash the application.
  }
}

const logger = {
  info(category, message, meta = {}) {
    write('info', category, message, meta);
  },
  warn(category, message, meta = {}) {
    write('warn', category, message, meta);
  },
  error(category, message, meta = {}) {
    write('error', category, message, meta);
  },
  debug(category, message, meta = {}) {
    write('debug', category, message, meta);
  },
  performance(label, startedAt, meta = {}) {
    const durationMs = Math.max(0, Date.now() - Number(startedAt || Date.now()));
    write('info', LOG_CATEGORIES.PERFORMANCE, label, { ...meta, durationMs });
  },
};

function readRecentLogs({ limit = 200 } = {}) {
  try {
    const logDirectory = getLogDirectory();
    const combinedPath = path.join(logDirectory, getLoggingConfig().files?.combined || 'combined.log');
    if (!fs.existsSync(combinedPath)) return [];
    const lines = fs.readFileSync(combinedPath, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, Math.min(Number(limit) || 200, 1000)));
  } catch {
    return [];
  }
}

function clearLogs() {
  try {
    const logDirectory = getLogDirectory();
    fs.mkdirSync(logDirectory, { recursive: true });
    for (const file of fs.readdirSync(logDirectory)) {
      if (file.endsWith('.log')) fs.writeFileSync(path.join(logDirectory, file), '');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'clear-logs-failed' };
  }
}

module.exports = {
  logger,
  LOG_CATEGORIES,
  readRecentLogs,
  clearLogs,
  getLogDirectory,
};
