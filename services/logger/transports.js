const fs = require('fs');
const path = require('path');
const winston = require('winston');

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function getLoggingConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config', 'logging-config.json');
  return readJsonSafe(configPath, {
    enabled: true,
    level: 'info',
    directory: 'logs',
    maxFileSizeBytes: 1048576,
    maxFiles: 5,
    files: { combined: 'combined.log', errors: 'error.log' },
  });
}

function getLogDirectory(config = getLoggingConfig()) {
  return path.join(__dirname, '..', '..', config.directory || 'logs');
}

function ensureLogDirectory(config) {
  const logDirectory = getLogDirectory(config);
  try {
    fs.mkdirSync(logDirectory, { recursive: true });
  } catch {
    return null;
  }
  return logDirectory;
}

function createTransports() {
  const config = getLoggingConfig();
  if (config.enabled === false) return [new winston.transports.Console({ silent: true })];

  const logDirectory = ensureLogDirectory(config);
  if (!logDirectory) return [new winston.transports.Console({ level: config.level || 'info' })];

  const maxsize = Number(config.maxFileSizeBytes) || 1048576;
  const maxFiles = Number(config.maxFiles) || 5;
  const files = config.files || {};

  return [
    new winston.transports.File({
      filename: path.join(logDirectory, files.combined || 'combined.log'),
      level: config.level || 'info',
      maxsize,
      maxFiles,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, files.errors || 'error.log'),
      level: 'error',
      maxsize,
      maxFiles,
      tailable: true,
    }),
  ];
}

module.exports = {
  createTransports,
  getLogDirectory,
  getLoggingConfig,
};
