const fs = require('fs');
const path = require('path');
const { parseCustomerQuery } = require('../../intent-detector');
const { normalizeQuery } = require('../search');
const { ConversationMemory } = require('../memory');
const { buildCustomerProfile } = require('../ai/response-contract');
const { applyDialoguePolicy, buildConversationState, countQuestions } = require('../conversation');
const { formatHumanResponse } = require('../humanizer');
const { buildResponsePlan } = require('../orchestration');
const { buildProductGallery } = require('../product-media');

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

function strategyMatches(actual, template, expected) {
  if (!expected) return true;
  if (actual === expected || template === expected) return true;
  const aliases = {
    clarification: ['stage7_family_discovery'],
    brand_list: ['stage7_family_brand_advice'],
    personal_advice: ['stage7_adult_brand_advice', 'stage7_family_brand_advice'],
  };
  return (aliases[expected] || []).includes(actual) || (aliases[expected] || []).includes(template);
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
    /\bbarcode\b/i,
    /\boffice\b/i,
    /Запомнила:/i,
    /Данные отсутствуют/i,
    /Я как ИИ/i,
    /согласно базе/i,
    /артикул/i,
    /остаток/i,
    /По длине стопы ориентир: нужно уточнить размер/i,
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
  return [
    ...readFixture('conversation-fixtures.json'),
    ...readFixture('stage7-conversation-fixtures.json'),
    ...readFixture('stage8-conversation-fixtures.json'),
    ...readFixture('stage9-orchestration-fixtures.json'),
    ...readFixture('stage10-store-consultant-fixtures.json'),
    ...readFixture('stage11-critical-ai-fixtures.json'),
  ].map((fixture) => {
    const turns = fixture.turns || [];
    const memory = new ConversationMemory({ ttlMinutes: 60, maxTurns: 8, maxSummaryChars: 700 });
    let previousState = fixture.previousConversationState || {};
    turns.slice(0, -1).forEach((turn) => {
      const priorParsed = parseCustomerQuery(turn);
      memory.addUserMessage(turn, priorParsed);
      previousState = buildConversationState({
        query: turn,
        parsedQuery: priorParsed,
        memoryState: memory.getState(),
        previousState,
        searchResults: {},
      });
    });
    const last = turns.slice(-1)[0] || '';
    const parsed = parseCustomerQuery(last);
    memory.addUserMessage(last, parsed);
    const memoryState = memory.getState();
    const customerProfile = buildCustomerProfile(memoryState, parsed).inferredCustomerProfile;
    const conversationState = buildConversationState({
      query: last,
      parsedQuery: parsed,
      memoryState,
      previousState,
      searchResults: {},
    });
    const useOrchestration = Boolean(fixture.expectedResponsePlan || String(fixture.name || '').startsWith('stage9-'));
    const responsePlan = useOrchestration
      ? buildResponsePlan({
          query: last,
          parsedQuery: parsed,
          conversationState,
          searchResults: {},
          billzConnected: fixture.billzConnected !== false,
        })
      : null;
    if (responsePlan) {
      conversationState.shouldSearchProducts = responsePlan.shouldSearchProducts;
      if (responsePlan.shouldClarify) {
        conversationState.nextBestAction = 'ask_clarifying_question';
        conversationState.clarificationCount = Number(conversationState.clarificationCount || 0) + 1;
        conversationState.lastClarificationReason = 'critical_info_missing';
      } else if (responsePlan.mode === 'availability_check' && responsePlan.shouldSearchProducts) {
        conversationState.nextBestAction = 'recommend_product';
      } else if (responsePlan.shouldRecommend && !responsePlan.shouldSearchProducts) {
        conversationState.nextBestAction = 'recommend_direction';
      }
      conversationState.selectedDialogueMove = conversationState.nextBestAction;
    }
    const productGallery = buildProductGallery(fixture.products || [], {
      intent: responsePlan?.mode === 'product_gallery' ? 'product_gallery' : '',
    });
    let formatted = formatHumanResponse({
      query: last,
      detectedIntent: parsed.intent,
      parsedQuery: parsed,
      products: [],
      recommendations: [],
      sizeRecommendation: parsed.sizeRecommendation,
      memoryEntities: memoryState.entities || {},
      memorySummary: memoryState.summary || '',
      customerProfile,
      conversationState,
      responsePlan,
      productGallery,
      brandSummary: { brandsAvailable: ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka'] },
    });
    let policy = applyDialoguePolicy(formatted.text, conversationState, {
      previousAssistantText: fixture.previousAssistantResponse || '',
    });
    if (policy.repetition.blockedByRepetition) {
      conversationState.blockedByRepetition = true;
      conversationState.nextBestAction = 'progress_conversation';
      conversationState.selectedDialogueMove = 'progress_conversation';
      conversationState.reasonForNextBestAction = 'blocked_by_repetition';
      formatted = formatHumanResponse({
        query: last,
        detectedIntent: parsed.intent,
        parsedQuery: parsed,
        products: [],
        recommendations: [],
        sizeRecommendation: parsed.sizeRecommendation,
        memoryEntities: memoryState.entities || {},
        memorySummary: memoryState.summary || '',
        customerProfile,
        conversationState,
        responsePlan,
        productGallery,
        brandSummary: { brandsAvailable: ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka'] },
      });
      policy = applyDialoguePolicy(formatted.text, conversationState);
    }
    formatted.text = policy.text;
    formatted.dialoguePolicy = policy;
    const textChecks = checkHumanizedText(formatted.text, fixture);
    const stateMismatches = compareExpected(conversationState, fixture.expectedConversationState || {});
    const planMismatches = compareExpected(responsePlan || {}, fixture.expectedResponsePlan || {});
    const questionCount = countQuestions(formatted.text);
    const tooManyQuestions = fixture.expectedMaxQuestions !== undefined && questionCount > fixture.expectedMaxQuestions;
    const ok = strategyMatches(formatted.strategy, formatted.templateUsed, fixture.expectedStrategy)
      && stateMismatches.length === 0
      && planMismatches.length === 0
      && textChecks.missing.length === 0
      && textChecks.forbiddenHits.length === 0
      && !tooManyQuestions
      && !textChecks.addressMissing;
    return result(fixture.name, ok, { expectedStrategy: fixture.expectedStrategy, stateMismatches, planMismatches, questionCount, tooManyQuestions, ...textChecks, formatted, parsed, conversationState, responsePlan });
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
