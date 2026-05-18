const { buildConversationState, initialConversationState } = require('./conversation-state');
const { applyDialoguePolicy, countQuestions, sanitizeConsultantText } = require('./dialogue-policy');
const { determineFreedom, freedomLevel } = require('./controlled-freedom');
const { detectNewInfo } = require('./new-info-detector');
const { detectRepetition } = require('./repetition-detector');
const { PERSONA } = require('./persona');
const { detectExplicitSubject, isFollowUpMessage, resolveAnchoredSubject } = require('./anchored-subject');
const { applyRecommendationProgression, buildRecommendationSnapshot, hasRecentRecommendation } = require('./recommendation-progress');

module.exports = {
  PERSONA,
  applyDialoguePolicy,
  applyRecommendationProgression,
  buildRecommendationSnapshot,
  buildConversationState,
  countQuestions,
  detectNewInfo,
  detectRepetition,
  detectExplicitSubject,
  determineFreedom,
  freedomLevel,
  hasRecentRecommendation,
  initialConversationState,
  isFollowUpMessage,
  resolveAnchoredSubject,
  sanitizeConsultantText,
};
