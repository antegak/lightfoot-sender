const COLORS = {
  BK: 'черный',
  WH: 'белый',
  BE: 'бежевый',
  WR: 'бордовый',
  PI: 'розовый',
  PK: 'розовый',
  LG: 'светло-зеленый',
  LR: 'светло-серый',
  GR: 'зеленый',
  BR: 'коричневый',
  GY: 'серый',
  RD: 'красный',
  RO: 'ярко-розовый',
  SB: 'небесно-голубой',
  TI: 'тиффани',
  PU: 'фиолетовый',
  LA: 'фиалка',
  YE: 'желтый',
  DG: 'темно-серый',
  KH: 'хаки',
  BG: 'темно-зеленый',
  DB: 'темно-синий',
  NV: 'темно-синий',
  GD: 'золото',
  OR: 'оранжевый',
};

const MATERIALS = {
  '01': 'кожа',
  '02': 'замша',
  '03': 'кожа/замша',
  '04': 'кожа(замша)/текстиль',
};

const BRANDS = {
  TT: 'TipsieToes',
  LL: 'Little Light',
  BB: 'Be Lenka',
  KT: 'Key Top',
  XZ: 'XZero',
  SAGUARO: 'Saguaro',
  BELENKA: 'Be Lenka',
};

const BRAND_LINES = {
  TipsieToes: 'adult',
  'Little Light': 'kids',
  Saguaro: 'family',
  'Be Lenka': 'external',
  'Key Top': 'family',
  XZero: 'family',
};

const STORES = {
  LF: {
    name: 'Коенкозова',
    address: 'Коенкозова 75, 3 подъезд, 2 этаж',
    note: 'вход со стороны Рыскулова',
    patterns: ['lf', 'коенкоз', 'koenkoz', 'рыскул', 'ryskul'],
  },
  'LF 9': {
    name: 'Байтик Баатыра',
    address: 'Байтик Баатыра 4/1',
    note: null,
    patterns: ['lf 9', 'lf9', 'байтик', 'баатыр', 'baitik', 'baatyr', 'baatyra'],
  },
};

const SIZE_TABLES = {
  adult: [
    { cm: 22.5, size: '34' },
    { cm: 23, size: '35' },
    { cm: 23.5, size: '36' },
    { cm: 24, size: '37' },
    { cm: 24.5, size: '38' },
    { cm: 25, size: '39' },
    { cm: 25.5, size: '40' },
    { cm: 26, size: '41' },
    { cm: 26.5, size: '42' },
    { cm: 27, size: '43' },
    { cm: 27.5, size: '44' },
    { cm: 28, size: '45' },
    { cm: 28.5, size: '46' },
  ],
  teen: [
    { cm: 20.5, size: '32' },
    { cm: 21, size: '33' },
    { cm: 21.5, size: '34' },
    { cm: 22, size: '35' },
    { cm: 22.5, size: '36' },
  ],
  kids: [
    { cm: 14, size: '22' },
    { cm: 14.5, size: '23' },
    { cm: 15, size: '24' },
    { cm: 15.5, size: '25' },
    { cm: 16, size: '26' },
    { cm: 16.5, size: '27' },
    { cm: 17, size: '28' },
    { cm: 17.5, size: '29' },
    { cm: 18, size: '30' },
    { cm: 18.5, size: '31' },
  ],
  Saguaro: [],
  TipsieToes: [],
  LittleLightKids: [
    { cm: 12.5, size: '19' },
    { cm: 13, size: '20' },
    { cm: 13.5, size: '21' },
    { cm: 14, size: '22' },
    { cm: 14.5, size: '23' },
    { cm: 15, size: '24' },
    { cm: 15.5, size: '24.5' },
    { cm: 16, size: '25' },
    { cm: 16.5, size: '25.5' },
    { cm: 17, size: '26' },
    { cm: 17.5, size: '26.5' },
    { cm: 18, size: '27' },
    { cm: 18.5, size: '27.5' },
    { cm: 19, size: '28' },
    { cm: 19.5, size: '29' },
    { cm: 20, size: '30' },
  ],
  LittleLightTeen: [
    { cm: 20.5, size: '31' },
    { cm: 21, size: '32' },
    { cm: 21.5, size: '33' },
    { cm: 22, size: '34' },
    { cm: 22.5, size: '35' },
    { cm: 23, size: '36' },
    { cm: 23.5, size: '37' },
    { cm: 24, size: '38' },
    { cm: 24.5, size: '39' },
  ],
  SaguaroKids: [
    { cm: 15.2, size: '24' },
    { cm: 15.9, size: '25' },
    { cm: 16.6, size: '26' },
    { cm: 17.3, size: '27' },
    { cm: 18, size: '28' },
    { cm: 18.7, size: '29' },
    { cm: 19.4, size: '30' },
    { cm: 20.1, size: '31' },
    { cm: 20.8, size: '32' },
    { cm: 21.5, size: '33' },
    { cm: 22.2, size: '34' },
    { cm: 22.9, size: '35' },
  ],
  SaguaroAdult: [
    { cm: 23.9, size: '36' },
    { cm: 24.6, size: '37' },
    { cm: 25.3, size: '38' },
    { cm: 26, size: '39' },
    { cm: 26.7, size: '40' },
    { cm: 27.4, size: '41' },
    { cm: 28.1, size: '42' },
    { cm: 28.8, size: '43' },
    { cm: 29.5, size: '44' },
    { cm: 30, size: '45' },
    { cm: 30.5, size: '46' },
    { cm: 31, size: '47' },
    { cm: 31.5, size: '48' },
    { cm: 32, size: '49' },
    { cm: 32.5, size: '50' },
  ],
};

function formatStoreAddress(store) {
  if (!store?.address) return '';
  return store.note ? `${store.address}\n(${store.note})` : store.address;
}

function getSizeByFootLength(cm, tableName = 'adult') {
  const length = Number(String(cm || '').replace(',', '.'));
  const table = SIZE_TABLES[tableName] || SIZE_TABLES.adult;
  if (!Number.isFinite(length) || !table.length) return null;
  return table.reduce((best, item) => (
    Math.abs(item.cm - length) < Math.abs(best.cm - length) ? item : best
  ), table[0]);
}

module.exports = {
  COLORS,
  MATERIALS,
  BRANDS,
  BRAND_LINES,
  STORES,
  SIZE_TABLES,
  formatStoreAddress,
  getSizeByFootLength,
};
