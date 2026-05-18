const { EMOJI } = require('./emoji-rules');

function brandDescription(brand) {
  const map = {
    TipsieToes: 'взрослые модели на каждый день',
    'Little Light': 'детская и подростковая линейка',
    Saguaro: 'спортивные и outdoor модели',
    'Be Lenka': 'премиальная barefoot обувь',
    'Key Top': 'легкие модели для активного дня',
    XZero: 'современные barefoot-модели',
  };
  return map[brand] || 'модели barefoot-направления';
}

const TEMPLATES = Object.freeze({
  stage9_comfort_consultation: ({ responsePlan }) => {
    const problem = responsePlan?.intent || '';
    const nail = problem === 'nail_problem';
    return [
      'Понимаю 💛',
      nail
        ? 'При вросших ногтях обычно важно, чтобы обувь не давила на пальцы и было больше места спереди.'
        : 'Когда обувь давит или натирает, лучше сначала смотреть мягкую посадку и свободный носок.',
      'Поэтому я бы шла в сторону мягких barefoot-моделей с более свободной формой 👣',
      'Могу подсказать направление на каждый день или что-то полегче/спортивнее.',
    ].join('\n');
  },
  stage9_school_sport_selection: ({ conversationState, responsePlan }) => {
    const child = conversationState?.childProfile || {};
    const brands = responsePlan?.suggestedBrands || [];
    if (brands.includes('Saguaro kids')) {
      return [
        '💛 Тогда ребенку я бы разделила так:',
        '• Little Light — на каждый день в школу',
        '• Saguaro kids — как сменку на физру и активность 👣',
        child.footLengthCm ? `На ${child.footLengthCm} см стопы уже можно подбирать детскую линейку.` : '',
        'Могу показать спокойные модели для школы и отдельно полегче на физру.',
      ].filter(Boolean).join('\n');
    }
    return [
      'Для школы я бы начала с Little Light 💛',
      'Нужна мягкая посадка и спокойный вид, чтобы ребенку было удобно весь день.',
      child.footLengthCm ? `По стопе ${child.footLengthCm} см смотрим детскую линейку.` : '',
      'Могу дальше подобрать более спокойные варианты.',
    ].filter(Boolean).join('\n');
  },
  stage9_style_guidance: ({ responsePlan }) => [
    'Для офиса я бы смотрела спокойные и аккуратные модели 💛',
    `${(responsePlan?.suggestedBrands || ['Be Lenka', 'TipsieToes']).join(' или ')} — хорошие направления: первые выглядят премиальнее, вторые мягче на каждый день.`,
    'Тут лучше не уходить в спорт, а выбрать нейтральный цвет и чистую форму.',
    'Могу показать варианты под ваш размер.',
  ].join('\n'),
  product_gallery: ({ productsText, productGallery, parsedQuery, responsePlan }) => {
    const brand = parsedQuery?.brand || responsePlan?.activeProfileData?.preferredBrand || '';
    const intro = brand
      ? `${EMOJI.heart} Вот варианты ${brand}, которые можно показать:`
      : `${EMOJI.heart} Вот несколько подходящих вариантов:`;
    const mediaFound = Boolean(productGallery?.mediaFound);
    return [
      intro,
      productsText,
      mediaFound
        ? 'Фото подготовлены из карточек товара.'
        : 'По этим моделям пока не вижу привязанных фото в карточках. Можно показать сами варианты, а фото подтянуть после добавления ссылок в BILLZ или product-media.json.',
    ].filter(Boolean).join('\n\n');
  },
  stage8_child_direction: ({ conversationState }) => {
    const child = conversationState?.childProfile || conversationState?.teenProfile || {};
    const useCase = child.useCase || conversationState?.newInfo?.value;
    if (useCase === 'school_pe' || useCase === 'sport') {
      return [
        'Поняла 💛 Тогда лучше разделить на две пары.',
        'В класс на каждый день — Little Light: мягко, спокойно, удобно сидеть и ходить.',
        'На физру/сменку — что-то легче и активнее; можно смотреть детские Saguaro, если в размере будут варианты.',
        child.footLengthCm ? `По стопе ${child.footLengthCm} см будем смотреть детскую линейку.` : '',
        'Дальше показать именно школьные или сразу варианты для физры?',
      ].filter(Boolean).join('\n');
    }
    if (useCase === 'school') {
      return [
        'Для школы я бы начала с Little Light 💛',
        'Тут лучше спокойный цвет и мягкая посадка, чтобы ребенку было удобно весь день.',
        child.footLengthCm ? `По стопе ${child.footLengthCm} см смотрим детскую линейку.` : 'Подберем по длине стопы, чтобы не брать наугад.',
        'Нужен больше классический вариант или можно чуть спортивнее?',
      ].join('\n');
    }
    return [
      'Для ребенка я бы начала с Little Light 💛',
      'Это спокойная детская/подростковая линия для ежедневной носки.',
      'Если нужна обувь для активных прогулок, можно смотреть Saguaro kids.',
      'Хотите больше мягкий повседневный вариант или спортивнее?',
    ].join('\n');
  },
  stage8_adult_direction: ({ conversationState }) => {
    const adult = conversationState?.adultProfile || {};
    if (adult.useCase === 'everyday') {
      return [
        `Для вас${adult.size ? ` в ${adult.size}` : ''} на каждый день рекомендую начать с TipsieToes.`,
        'Это мягкое и понятное направление для ежедневной носки.',
        'Если хочется более стильную и премиальную посадку - тогда Be Lenka.',
        adult.size ? `Дальше логично показать варианты в ${adult.size}.` : 'Дальше логично показать подходящие варианты.',
      ].join('\n');
    }
    return [
      `Для вас${adult.size ? ` в ${adult.size}` : ''} я бы сузила выбор до TipsieToes или Be Lenka.`,
      'TipsieToes - мягче на каждый день.',
      'Be Lenka - премиальнее и стильнее.',
      adult.size ? `Дальше можно показать варианты в ${adult.size}.` : 'Дальше можно показать варианты.',
    ].join('\n');
  },
  stage8_correction_ack: ({ conversationState }) => {
    const adultSize = conversationState?.adultProfile?.size || conversationState?.newInfo?.value;
    const childCm = conversationState?.childProfile?.footLengthCm;
    return [
      `Все нормально 💛 Тогда для вас смотрим ${adultSize || 'уточненный'} размер.`,
      childCm ? `Для ребенка оставляем ${childCm} см стопы.` : '',
    ].filter(Boolean).join('\n');
  },
  stage8_progression: ({ conversationState }) => {
    if (conversationState?.activeSubject === 'childProfile' || conversationState?.activeSubject === 'teenProfile') {
      return [
        'Поняла, смотрим именно для ребенка 💛',
        'Для школы — Little Light, для более активной сменки или физры — можно рассмотреть детские Saguaro.',
        'Лучше сначала подобрать пару в класс или отдельную на физру?',
      ].join('\n');
    }
    return [
      'Поняла, держим фокус на взрослых моделях.',
      'Мы уже сузили направление: TipsieToes для мягкой ежедневной носки, Be Lenka для более премиальной посадки.',
      'Следующий шаг - показать конкретные варианты по размеру.',
    ].join('\n');
  },
  stage7_family_discovery: () => [
    'Подберем 💛',
    'Для вас и для ребенка лучше смотреть отдельно.',
    'Напишите ваш размер, а ребенку — длину стопы 👣',
  ].join('\n'),
  stage7_family_brand_advice: ({ conversationState }) => {
    const adultSize = conversationState?.adultProfile?.size;
    const childCm = conversationState?.childProfile?.footLengthCm;
    const childSize = conversationState?.childProfile?.size;
    return [
      'Я бы разделила так 💛',
      '',
      `Для вас${adultSize ? ` в ${adultSize} размере` : ''}: TipsieToes или Be Lenka.`,
      'TipsieToes мягче и проще на каждый день, Be Lenka - более премиальный вариант.',
      '',
      `Для ребенка${childCm ? ` ${childCm} см` : ''}${childSize ? `, примерно ${childSize} размер` : ''}: Little Light - лучше начать с нее, это детская/подростковая линейка.`,
    ].join('\n');
  },
  stage7_adult_brand_advice: ({ conversationState }) => {
    const size = conversationState?.adultProfile?.size;
    return [
      `Для вас${size ? ` в ${size} размере` : ''} я бы сначала смотрела TipsieToes или Be Lenka 💛`,
      '',
      'Если хотите мягче и на каждый день - TipsieToes.',
      'Если хочется более премиальную посадку и стиль - Be Lenka.',
      'Для активной носки можно еще смотреть Saguaro.',
      '',
      size ? `Могу сразу показать варианты в ${size} размере?` : 'Могу сразу показать подходящие варианты?',
    ].join('\n');
  },
  stage7_child_brand_advice: ({ conversationState }) => {
    const child = conversationState?.childProfile || conversationState?.teenProfile || {};
    const cm = child.footLengthCm;
    const size = child.size;
    return [
      `Для ребенка${cm ? ` при стопе ${cm} см` : ''}${size ? ` примерно ${size} размер` : ''} я бы начала с Little Light 💛`,
      '',
      'Это детская/подростковая линейка, ее проще подбирать по длине стопы.',
      'Если нужна более активная обувь для прогулок или спорта - можно смотреть детские Saguaro.',
      '',
      'Могу показать варианты по этому размеру?',
    ].join('\n');
  },
  stage7_brand_comparison: () => [
    'Если коротко 💛',
    '',
    'TipsieToes - мягче и проще на каждый день.',
    'Be Lenka - премиальнее по посадке и стилю.',
    'Saguaro - больше для активной носки, спорта и прогулок.',
  ].join('\n'),
  stage7_child_size_advice: ({ conversationState }) => {
    const child = conversationState?.childProfile || conversationState?.teenProfile || {};
    return [
      `По стопе ${child.footLengthCm || ''} см я бы смотрела примерно ${child.size || ''} размер 💛`.replace(/\s+/g, ' ').trim(),
      'Для ребенка лучше оставить небольшой запас, чтобы обувь не была впритык.',
      '',
      'По брендам сначала смотрим Little Light, а для активной носки можно Saguaro kids.',
    ].join('\n');
  },
  availability: ({ productsText, branchesText }) => [
    `${EMOJI.heart} Есть подходящие варианты:`,
    productsText,
    branchesText,
  ].filter(Boolean).join('\n\n'),
  unavailable: ({ recommendationsText, branchesText }) => [
    `${EMOJI.heart} Сейчас не вижу точного совпадения по запросу.`,
    recommendationsText ? `Могу предложить близкие варианты:\n${recommendationsText}` : 'Могу уточнить размер или подобрать похожие модели.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  recommendation: ({ productsText, branchesText }) => [
    `${EMOJI.heart} Я бы посмотрела эти варианты:`,
    productsText,
    'Для широкой стопы barefoot-модели часто комфортнее за счет более свободной формы носка. Это не медицинская рекомендация, но по ощущениям обычно мягче для пальцев.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  personal_advice: ({ customerProfile, memoryEntities }) => {
    const size = customerProfile?.adultSize || memoryEntities?.adultSize || memoryEntities?.preferredSize;
    return [
      `${EMOJI.heart} Вам я бы смотрела взрослую линейку в ${size || 'вашем'} размере:`,
      '• TipsieToes — мягкие модели на каждый день',
      '• Be Lenka — более премиальная barefoot посадка',
      '• Saguaro — если хочется легче и спортивнее',
      'Если стопа широкая, лучше начать с моделей с более свободным носком.',
    ].filter(Boolean).join('\n\n');
  },
  family_profile_update: ({ customerProfile, memoryEntities }) => {
    const adultSize = customerProfile?.adultSize || memoryEntities?.adultSize || memoryEntities?.preferredSize;
    const childFootLength = customerProfile?.childFootLength || memoryEntities?.childFootLength;
    const childSize = customerProfile?.childRecommendedSize || memoryEntities?.childRecommendedSize;
    return [
      `${EMOJI.heart} Отлично, тогда для вас держим ${adultSize || 'взрослый'} размер.`,
      childFootLength || childSize
        ? `Для ребенка — ${childFootLength ? `${childFootLength} см стопа` : 'по стопе'}${childSize ? `, примерно ${childSize} размер` : ''}.`
        : '',
      'Можем начать с ребенка: для школы чаще всего смотрят Little Light.',
    ].filter(Boolean).join('\n\n');
  },
  clarification: ({ parsedQuery, branchesText, fallbackReason }) => {
    if (fallbackReason === 'child_or_teen_without_foot_length') {
      return [
        `${EMOJI.heart} Подберем.`,
        parsedQuery?.raw && /для себя/i.test(parsedQuery.raw)
          ? 'Для взрослого напишите размер, а для ребенка - сколько см стопа. Так подберем точнее и не будем угадывать 😊'
          : 'Напишите, пожалуйста, сколько см стопа - так получится подобрать размер точнее 😊',
        branchesText,
      ].filter(Boolean).join('\n\n');
    }
    const parts = [];
    if (!parsedQuery?.size) parts.push('размер');
    if (!parsedQuery?.colorHuman && !parsedQuery?.color) parts.push('цвет');
    return [
      `${EMOJI.heart} Подскажу. Уточните, пожалуйста, ${parts.join(' и ') || 'размер'}?`,
      branchesText,
    ].filter(Boolean).join('\n\n');
  },
  sizing: ({ sizeRecommendation, branchesText }) => [
    `${EMOJI.feet} По длине стопы ориентир: ${sizeRecommendation?.size || 'нужно уточнить'} размер.`,
    'Для детей лучше оставлять небольшой запас 0,5-1 см, чтобы обувь не была впритык.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  branch_info: ({ branchesText }) => branchesText,
  brand_list: ({ brandSummary, customerProfile, memoryEntities }) => {
    const adultSize = customerProfile?.adultSize || memoryEntities?.adultSize || memoryEntities?.preferredSize;
    const childFootLength = customerProfile?.childFootLength || memoryEntities?.childFootLength;
    const childSize = customerProfile?.childRecommendedSize || memoryEntities?.childRecommendedSize;
    if (adultSize || childFootLength || childSize) {
      return [
        `${EMOJI.heart} Тогда я бы разделила так:`,
        adultSize ? `Для вас (${adultSize} размер): TipsieToes, Be Lenka или Saguaro.` : 'Для взрослого: TipsieToes, Be Lenka или Saguaro.',
        childFootLength || childSize
          ? `Для ребенка (${childFootLength ? `${childFootLength} см стопа` : 'по стопе'}${childSize ? `, ориентир ${childSize} размер` : ''}): Little Light или Saguaro kids.`
          : 'Для ребенка: Little Light или Saguaro kids.',
        'Если хотите мягче на каждый день - начнем с TipsieToes для вас и Little Light для ребенка.',
      ].filter(Boolean).join('\n\n');
    }
    const brands = brandSummary?.brandsAvailable?.length
      ? brandSummary.brandsAvailable
      : ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka', 'Key Top', 'XZero'];
    return [
      `${EMOJI.heart} У нас есть несколько брендов:`,
      brands.map((brand) => `• ${brand} — ${brandDescription(brand)}`).join('\n'),
    ].filter(Boolean).join('\n\n');
  },
});

module.exports = { TEMPLATES };
