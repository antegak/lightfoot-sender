function buildMemorySummary(turns = [], entities = {}, maxChars = 700) {
  const parts = [];
  if (entities.preferredBrand) parts.push(`brand=${entities.preferredBrand}`);
  if (entities.preferredColor) parts.push(`color=${entities.preferredColor}`);
  if (entities.preferredSize) parts.push(`size=${entities.preferredSize}`);
  if (entities.footLength) parts.push(`footLength=${entities.footLength}cm`);
  if (entities.childAge) parts.push(`childAge=${entities.childAge}`);
  if (entities.lastIntent) parts.push(`intent=${entities.lastIntent}`);
  const recent = turns.slice(-3).map((turn) => `${turn.role}: ${String(turn.content || '').slice(0, 120)}`).join(' | ');
  const summary = [parts.join(', '), recent].filter(Boolean).join(' || ');
  return summary.length > maxChars ? `${summary.slice(0, maxChars - 3)}...` : summary;
}

module.exports = { buildMemorySummary };
