const fs = require('fs');
const path = require('path');
const { parseCustomerQuery } = require('../../intent-detector');
const { normalizeQuery } = require('../search');
const { ConversationMemory } = require('../memory');
const { buildCustomerProfile } = require('../ai/response-contract');
const { formatHumanResponse } = require('../humanizer');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures');

function readFixture(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
  } catch {
    return [];
  }
}

function compareExpected(actual, expected = {}) {
  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (key === 'modeOneOf' || key === 'context') continue;
    const actualValue = actual?.[key];
    if (Array.isArray(expectedValue)) {
      const actualList = Array.isArray(actualValue) ? actualValue : [];
      const missing = expectedValue.filter((item) => !actualList.includes(item));
      if (missing.length) mismatches.push({ key, expected: expectedValue, actual: actualValue });
    } else if (expectedValue === null) {
      if (actualValue !== null && actualValue !== undefined && actualValue !== '') mismatches.push({ key, expected: null, actual: actualValue });
    } else if (actualValue !== expectedValue) {
      mismatches.push({ key, expected: expectedValue, actual: actualValue });
    }
  }
  return mismatches;
}

function result(name, ok, details = {}) {
  return { name, status: ok ? 'passed' : 'failed', ...details };
}

function checkHumanizedText(text, fixture = {}) {
  const missing = (fixture.expectedContains || []).filter((part) => !text.includes(part));
  const forbidden = [
    ...(fixture.expectedNotContains || []),
    /\b\d{1,2}\/\d{2}\b/,
    /\bLF 9\b/,
    /\bLF\b/,
    /\bSKU\b/i,
    /\bstock\b/i,
    /остаток/i,
    /доступно только/i,
    /только в филиале/i,
  ];
  const forbiddenHits = forbidden
    .map((rule) => {
      if (rule instanceof RegExp) return rule.test(text) ? String(rule) : '';
      return text.includes(rule) ? rule : '';
    })
    .filter(Boolean);
  const requiresAddress = fixture.requireAddresses === true
    || (fixture.expectedContains || []).some((part) => String(part).includes('Коенкозова') || String(part).includes('Байтик Баатыра'));
  const addressMissing = requiresAddress && !(text.includes('Коенкозова') && text.includes('Байтик Баатыра'));
  return { missing, forbiddenHits, addressMissing };
}

function runParserFixtures() {
  return readFixture('parser-fixtures.json').map((fixture) => {
    const parsed = parseCustomerQuery(fixture.query);
    const mismatches = compareExpected(parsed, fixture.expected);
    return result(fixture.query, mismatches.length === 0, { mismatches, parsed });
  });
}

function runSearchFixtures() {
  return readFixture('search-fixtures.json').map((fixture) => {
    const parsed = normalizeQuery(fixture.query, fixture.memory || {});
    const mismatches = compareExpected(parsed, fixture.expected);
    return result(fixture.query, mismatches.length === 0, { mismatches, parsed });
  });
}

function runMemoryFixtures() {
  return readFixture('memory-fixtures.json').map((fixture) => {
    const memory = new ConversationMemory({ ttlMinutes: 60, maxTurns: 8, maxSummaryChars: 700 });
    for (const turn of fixture.turns || []) {
      memory.addUserMessage(turn, parseCustomerQuery(turn));
    }
    const state = memory.getState();
    const mismatches = compareExpected(state.entities, fixture.expectedEntities);
    return result(fixture.name, mismatches.length === 0, { mismatches, memory: state });
  });
}

function runHumanizationFixtures() {
  return readFixture('humanization-fixtures.json').map((fixture) => {
    const formatted = formatHumanResponse({
      detectedIntent: fixture.input?.intent,
      parsedQuery: { intent: fixture.input?.intent },
      products: fixture.input?.products || [],
      brandSummary: { brandsAvailable: ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka', 'Key Top', 'XZero'] },
    });
    const checks = checkHumanizedText(formatted.text, fixture);
    return result(fixture.name, checks.missing.length === 0 && checks.forbiddenHits.length === 0 && !checks.addressMissing, { ...checks, formatted });
  });
}

function runConversationFixtures() {
  return readFixture('conversation-fixtures.json').map((fixture) => {
    const turns = fixture.turns || [];
    const memory = new ConversationMemory({ ttlMinutes: 60, maxTurns: 8, maxSummaryChars: 700 });
    turns.slice(0, -1).forEach((turn) => memory.addUserMessage(turn, parseCustomerQuery(turn)));
    const last = turns.slice(-1)[0] || '';
    const parsed = parseCustomerQuery(last);
    memory.addUserMessage(last, parsed);
    const memoryState = memory.getState();
    const customerProfile = buildCustomerProfile(memoryState, parsed).inferredCustomerProfile;
    const formatted = formatHumanResponse({
      query: last,
      detectedIntent: parsed.intent,
      parsedQuery: parsed,
      products: [],
      recommendations: [],
      sizeRecommendation: parsed.sizeRecommendation,
      memoryEntities: memoryState.entities || {},
      memorySummary: memoryState.summary || '',
      customerProfile,
      brandSummary: { brandsAvailable: ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka'] },
    });
    const textChecks = checkHumanizedText(formatted.text, fixture);
    const ok = (!fixture.expectedStrategy || formatted.strategy === fixture.expectedStrategy || formatted.templateUsed === fixture.expectedStrategy)
      && textChecks.forbiddenHits.length === 0
      && !textChecks.addressMissing;
    return result(fixture.name, ok, { expectedStrategy: fixture.expectedStrategy, ...textChecks, formatted, parsed });
  });
}

function summarize(groups) {
  const flat = Object.values(groups).flat();
  const passed = flat.filter((item) => item.status === 'passed').length;
  const failed = flat.length - passed;
  return { total: flat.length, passed, failed, status: failed ? 'failed' : 'passed' };
}

function runQaFixtures() {
  const groups = {
    parser: runParserFixtures(),
    search: runSearchFixtures(),
    memory: runMemoryFixtures(),
    humanization: runHumanizationFixtures(),
    conversation: runConversationFixtures(),
  };
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: summarize(groups),
    groups,
  };
}

module.exports = {
  runQaFixtures,
  runParserFixtures,
  runSearchFixtures,
  runMemoryFixtures,
  runHumanizationFixtures,
  runConversationFixtures,
};
