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
  stage7_family_discovery: () => [
    'Конечно 💛',
    'Для вас подберем отдельно, для ребенка отдельно - так будет точнее.',
    '',
    'Напишите, пожалуйста:',
    'для вас - размер или длину стопы,',
    'для ребенка - сколько см стопа 👣',
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
      `Для ребенка${childCm ? ` ${childCm} см` : ''}${childSize ? `, ориентир ${childSize} размер` : ''}: Little Light - лучше начать с нее, потому что это детская/подростковая линейка.`,
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
      `Для ребенка${cm ? ` при стопе ${cm} см` : ''}${size ? ` ориентир ${size} размер` : ''} я бы начала с Little Light 💛`,
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
      `${EMOJI.heart} Отлично. Для вас смотрим ${adultSize || 'взрослый'} размер.`,
      childFootLength || childSize
        ? `Для ребенка: ${childFootLength ? `${childFootLength} см стопа` : 'по стопе'}${childSize ? `, ориентир ${childSize} размер` : ''}.`
        : '',
      'Дальше можно подобрать отдельно: вам - взрослые TipsieToes, Be Lenka или Saguaro, ребенку - Little Light или детские Saguaro.',
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
