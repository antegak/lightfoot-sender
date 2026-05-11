const { EMOJI } = require('./emoji-rules');

const BRANCHES = [
  {
    code: 'LF',
    address: 'Коенкозова 75, 3 подъезд, 2 этаж',
    note: 'вход со стороны Рыскулова',
  },
  {
    code: 'LF 9',
    address: 'Байтик Баатыра 4/1',
    note: '',
  },
];

function humanizeBranch(branch = {}) {
  const code = String(branch.code || branch.name || '').trim();
  const known = BRANCHES.find((item) => item.code === code) || branch;
  const address = known.address || branch.formatted || branch.name || '';
  if (!address) return '';
  const note = known.note ? `\n(${known.note})` : '';
  return `${EMOJI.pin}${address}${note}`;
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
