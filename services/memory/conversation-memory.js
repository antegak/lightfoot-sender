const fs = require('fs');
const path = require('path');
const { extractEntities, mergeEntities } = require('./entity-memory');
const { buildMemorySummary } = require('./memory-summary');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'memory-config.json'), 'utf8'));
  } catch {
    return { ttlMinutes: 60, maxTurns: 8, maxSummaryChars: 700 };
  }
}

function isExpired(updatedAt, ttlMinutes) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > ttlMinutes * 60 * 1000;
}

class ConversationMemory {
  constructor(config = readConfig()) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.turns = [];
    this.entities = {};
    this.updatedAt = new Date().toISOString();
    this.summary = '';
  }

  ensureFresh() {
    if (isExpired(this.updatedAt, Number(this.config.ttlMinutes) || 60)) this.reset();
  }

  addUserMessage(content, parsed = {}) {
    this.ensureFresh();
    this.turns.push({ role: 'user', content: String(content || '').trim(), createdAt: new Date().toISOString() });
    this.entities = mergeEntities(this.entities, extractEntities(parsed));
    this.trim();
    this.refreshSummary();
  }

  addAssistantMessage(content) {
    this.ensureFresh();
    this.turns.push({ role: 'assistant', content: String(content || '').trim(), createdAt: new Date().toISOString() });
    this.trim();
    this.refreshSummary();
  }

  trim() {
    const maxTurns = Math.max(2, Number(this.config.maxTurns) || 8);
    this.turns = this.turns.slice(-maxTurns);
    this.updatedAt = new Date().toISOString();
  }

  refreshSummary() {
    this.summary = buildMemorySummary(this.turns, this.entities, Number(this.config.maxSummaryChars) || 700);
  }

  getState() {
    this.ensureFresh();
    return {
      shortTerm: this.turns.slice(),
      summary: this.summary,
      entities: { ...this.entities },
      updatedAt: this.updatedAt,
      ttlMinutes: Number(this.config.ttlMinutes) || 60,
    };
  }
}

module.exports = { ConversationMemory };
