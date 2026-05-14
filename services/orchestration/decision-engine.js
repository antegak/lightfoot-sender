const { buildResponsePlan } = require('./response-planner');

function decideOrchestration(input = {}) {
  return buildResponsePlan(input);
}

module.exports = {
  decideOrchestration,
};
