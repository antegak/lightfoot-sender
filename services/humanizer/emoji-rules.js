const EMOJI = Object.freeze({
  heart: '💛',
  feet: '👣',
  sparkle: '✨',
  smile: '😊',
  pin: '📍',
});

function pickEmoji(name, config = {}) {
  if (config.emojiLevel === 'none') return '';
  return EMOJI[name] || '';
}

module.exports = { EMOJI, pickEmoji };
