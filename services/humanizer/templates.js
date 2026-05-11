const { EMOJI } = require('./emoji-rules');

const TEMPLATES = Object.freeze({
  availability: ({ productsText, branchesText }) => [
    `${EMOJI.heart} Есть подходящие варианты:`,
    productsText,
    branchesText,
  ].filter(Boolean).join('\n\n'),
  unavailable: ({ recommendationsText, branchesText }) => [
    `${EMOJI.heart} Сейчас не вижу точного совпадения по запросу.`,
    recommendationsText ? `Могу предложить близкие варианты:\n${recommendationsText}` : 'Могу уточнить наличие по размеру или подобрать похожие модели.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  recommendation: ({ productsText, branchesText }) => [
    `${EMOJI.heart} Я бы посмотрела эти варианты:`,
    productsText,
    'Для широкой стопы barefoot-модели часто комфортнее за счет более свободной формы носка. Это не медицинская рекомендация, но по ощущениям обычно мягче для пальцев.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  clarification: ({ parsedQuery }) => {
    const parts = [];
    if (!parsedQuery?.size) parts.push('размер');
    if (!parsedQuery?.colorHuman && !parsedQuery?.color) parts.push('цвет');
    return `${EMOJI.heart} Подскажу. Уточните, пожалуйста, ${parts.join(' и ') || 'размер'}?`;
  },
  sizing: ({ sizeRecommendation, branchesText }) => [
    `${EMOJI.feet} По длине стопы ориентир: ${sizeRecommendation?.size || 'нужно уточнить'} размер.`,
    'Для детей лучше оставлять небольшой запас 0,5-1 см, чтобы обувь не была впритык.',
    branchesText,
  ].filter(Boolean).join('\n\n'),
  branch_info: ({ branchesText }) => branchesText,
  brand_list: ({ brandSummary }) => {
    const brands = brandSummary?.brandsAvailable?.length
      ? brandSummary.brandsAvailable
      : ['TipsieToes', 'Little Light', 'Saguaro', 'Be Lenka', 'Key Top', 'XZero'];
    return [
      `${EMOJI.heart} У нас есть несколько направлений:`,
      brands.map((brand) => `• ${brand}`).join('\n'),
      'TipsieToes чаще взрослая линейка, Little Light — детская, Saguaro — легкие barefoot-модели для разных возрастов.',
    ].join('\n\n');
  },
});

module.exports = { TEMPLATES };
