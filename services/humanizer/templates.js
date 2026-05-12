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
  brand_list: ({ brandSummary, branchesText }) => {
    const brands = brandSummary?.brandsAvailable?.length
      ? brandSummary.brandsAvailable
      : ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka', 'Key Top', 'XZero'];
    return [
      `${EMOJI.heart} У нас есть несколько брендов:`,
      brands.map((brand) => `• ${brand} — ${brandDescription(brand)}`).join('\n'),
      branchesText,
    ].filter(Boolean).join('\n\n');
  },
});

module.exports = { TEMPLATES };
