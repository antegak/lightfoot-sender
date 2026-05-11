const { EMOJI } = require('./emoji-rules');
const { STORES, formatStoreAddress } = require('../../knowledge-base');

const BRANCHES = Object.entries(STORES).map(([code, store]) => ({
  code,
  address: store.address,
  note: store.note || '',
  formatted: formatStoreAddress(store),
}));

function humanizeBranch(branch = {}) {
  const code = String(branch.code || branch.name || '').trim();
  const known = BRANCHES.find((item) => item.code === code) || branch;
  const formatted = known.formatted || branch.formatted || (
    known.address ? formatStoreAddress(known) : (branch.name || '')
  );
  if (!formatted) return '';
  return `${EMOJI.pin}${formatted}`;
}

function humanizeBranches(branches) {
  const list = Array.isArray(branches) && branches.length ? branches : BRANCHES;
  return list.map(humanizeBranch).filter(Boolean).join('\n\n');
}

module.exports = {
  BRANCHES,
  humanizeBranch,
  humanizeBranches,
};
