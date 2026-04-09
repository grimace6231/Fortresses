import { DISTRICT_CARDS } from '../../../shared/constants.js';

export function createDeck() {
  const deck = [];
  let id = 0;
  for (const card of DISTRICT_CARDS) {
    for (let i = 0; i < card.count; i++) {
      const entry = {
        id: id++,
        name: card.name,
        cost: card.cost,
        color: card.color,
      };
      if (card.desc) entry.desc = card.desc;
      deck.push(entry);
    }
  }
  return shuffle(deck);
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
