const { buildStage7CustomerProfiles } = require('./customer-profile');
const { inferActiveSubject, inferCurrentFocus } = require('./topic-tracker');
const { determineSalesFlow, inferCurrentStage } = require('./sales-flow');
const { determineNextBestAction, shouldSearchProducts } = require('./next-best-action');
const { determineFreedom } = require('./controlled-freedom');
const { detectNewInfo } = require('./new-info-detector');
const { resolveAnchoredSubject } = require('./anchored-subject');

function initialConversationState() {
  return {
    currentFocus: null,
    currentStage: null,
    customerType: null,
    activeSubject: null,
    anchoredConversationSubject: null,
    adultProfile: {},
    childProfile: {},
    teenProfile: {},
    discussedBrands: [],
    lastQuestion: null,
    lastRecommendation: null,
    recommendationHistory: [],
    currentIntent: null,
    previousIntent: null,
    lastHealthIntent: null,
    lastHealthIntentTurns: 0,
    missingInfo: [],
    clarificationCount: 0,
    lastClarificationReason: '',
    nextBestAction: null,
    shouldSearchProducts: false,
    salesFlow: null,
    freedomLevel: null,
    hasNewInfo: false,
    newInfoType: null,
    selectedDialogueMove: null,
    reasonForNextBestAction: '',
    blockedByRepetition: false,
    confidence: 0,
  };
}

function missingInfoFor(state = {}) {
  const missing = [];
  if (state.currentFocus === 'family_selection') {
    if (!state.adultProfile?.size && !state.adultProfile?.footLengthCm) missing.push('adult_size_or_foot_length');
    if (!state.childProfile?.footLengthCm && !state.childProfile?.size) missing.push('child_foot_length');
  }
  if ((state.currentFocus === 'adult_selection' || state.activeSubject === 'adultProfile') && !state.adultProfile?.size && !state.adultProfile?.footLengthCm) {
    missing.push('adult_size_or_foot_length');
  }
  if ((state.currentFocus === 'child_selection' || state.activeSubject === 'childProfile') && !state.childProfile?.footLengthCm && !state.childProfile?.size) {
    missing.push('child_foot_length');
  }
  return missing;
}

function buildConversationState({
  query = '',
  parsedQuery = {},
  memoryState = {},
  previousState = {},
  searchResults = {},
} = {}) {
  const previousHealthTurns = Math.max(0, Number(previousState.lastHealthIntentTurns || 0) - 1);
  const profiles = buildStage7CustomerProfiles(memoryState, parsedQuery, query);
  const newInfo = detectNewInfo(query, parsedQuery, previousState, profiles);
  const inferredSubject = inferActiveSubject(query, parsedQuery, profiles, previousState);
  const anchoredConversationSubject = resolveAnchoredSubject({
    query,
    parsedQuery,
    profiles,
    previousAnchor: previousState.anchoredConversationSubject || null,
    inferredSubject,
  });
  const activeSubject = anchoredConversationSubject?.profile || inferredSubject;
  const currentFocus = inferCurrentFocus(query, parsedQuery, profiles, activeSubject, previousState);
  const baseState = {
    ...initialConversationState(),
    ...previousState,
    query,
    currentIntent: parsedQuery.intent || previousState.currentIntent || null,
    previousIntent: previousState.currentIntent || previousState.selectedIntent || previousState.previousIntent || null,
    lastHealthIntent: previousHealthTurns > 0 ? previousState.lastHealthIntent : null,
    lastHealthIntentTurns: previousHealthTurns,
    currentFocus,
    activeSubject,
    anchoredConversationSubject,
    customerType: profiles.customerProfile.type || parsedQuery.customerType || memoryState.entities?.customerType || 'unknown',
    customerProfile: profiles.customerProfile,
    adultProfile: profiles.adultProfile,
    childProfile: profiles.childProfile,
    teenProfile: profiles.teenProfile,
    newInfo,
    hasNewInfo: newInfo.hasNewInfo,
    newInfoType: newInfo.newInfoType,
    discussedBrands: Array.from(new Set([...(previousState.discussedBrands || []), parsedQuery.brand].filter(Boolean))),
  };
  baseState.currentStage = inferCurrentStage(currentFocus, parsedQuery, baseState);
  baseState.missingInfo = missingInfoFor(baseState);
  baseState.nextBestAction = determineNextBestAction(baseState, parsedQuery, searchResults);
  baseState.shouldSearchProducts = shouldSearchProducts(baseState, parsedQuery, searchResults);
  baseState.salesFlow = determineSalesFlow(baseState);
  if (baseState.nextBestAction === 'recommend_direction' || baseState.nextBestAction === 'acknowledge_correction' || baseState.nextBestAction === 'progress_conversation') baseState.shouldSearchProducts = false;
  baseState.confidence = Math.max(
    profiles.customerProfile.confidence || 0,
    profiles.adultProfile.confidence || 0,
    profiles.childProfile.confidence || 0,
    baseState.currentFocus && baseState.currentFocus !== 'unknown' ? 55 : 30
  );
  baseState.freedom = determineFreedom(baseState, parsedQuery, searchResults, { billzConnected: searchResults.connected !== false });
  baseState.freedomLevel = baseState.freedom.freedomLevel;
  baseState.selectedDialogueMove = baseState.nextBestAction;
  baseState.reasonForNextBestAction = baseState.freedom.reason || '';
  return baseState;
}

module.exports = {
  buildConversationState,
  initialConversationState,
};
