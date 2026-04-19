// Role definitions. `rank` is the turn-order slot; multiple roles can share a
// rank (e.g. Architect and Scholar both rank 7), but only one occupies that
// slot in a given game config. `bonus` describes any passive color-bonus the
// role collects ({ color, resource: 'gold' | 'card' }); used by the generic
// collect-bonus action.
export const ROLES = {
  ASSASSIN:      { id: 1,  rank: 1, name: 'Assassin',      color: null },
  THIEF:         { id: 2,  rank: 2, name: 'Thief',         color: null },
  MAGICIAN:      { id: 3,  rank: 3, name: 'Magician',      color: null },
  KING:          { id: 4,  rank: 4, name: 'King',          color: 'noble',     bonus: { color: 'noble',     resource: 'gold' } },
  BISHOP:        { id: 5,  rank: 5, name: 'Bishop',        color: 'religious', bonus: { color: 'religious', resource: 'gold' } },
  MERCHANT:      { id: 6,  rank: 6, name: 'Merchant',      color: 'trade',     bonus: { color: 'trade',     resource: 'gold' } },
  ARCHITECT:     { id: 7,  rank: 7, name: 'Architect',     color: null },
  WARLORD:       { id: 8,  rank: 8, name: 'Warlord',       color: 'military',  bonus: { color: 'military',  resource: 'gold' } },
  QUEEN:         { id: 9,  rank: 9, name: 'Queen',         color: null },
  SCHOLAR:       { id: 10, rank: 7, name: 'Scholar',       color: null },
  PATRICIAN:     { id: 11, rank: 4, name: 'Patrician',     color: 'noble',     bonus: { color: 'noble',     resource: 'card' } },
  CARDINAL:      { id: 12, rank: 5, name: 'Cardinal',      color: 'religious', bonus: { color: 'religious', resource: 'card' } },
  TRADER:        { id: 13, rank: 6, name: 'Trader',        color: 'trade',     bonus: { color: 'trade',     resource: 'gold' } },
  TAX_COLLECTOR: { id: 14, rank: 9, name: 'Tax Collector', color: null },
};

export const ROLE_LIST = Object.values(ROLES).sort((a, b) => a.rank - b.rank);

// Role configs. Each config defines a `baseRoleIds` (ranks 1–8) and, if the
// scenario has a rank-9 character, a `rank9` descriptor so the UI can render
// a toggle. Per the 2016 rulebook, rank-9 characters are optional with 4–7
// players and this project adapts that to our 2-player setting.
export const ROLE_CONFIGS = {
  classic: {
    label: 'Classic',
    description: 'The original 8 roles.',
    baseRoleIds: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  brave: {
    label: 'Brave',
    description: 'Classic roles; optionally adds the Queen at rank 9.',
    baseRoleIds: [1, 2, 3, 4, 5, 6, 7, 8],
    rank9: {
      id: 9,
      label: 'Include Queen (rank 9)',
      description: 'Earns +3 gold on her turn when the other player holds the crown token.',
      defaultInclude: true,
    },
  },
  scholarly: {
    label: 'Scholarly',
    description: 'Scholar replaces the Architect at rank 7. Draws 7 cards and keeps 1 (no gold, no extra builds).',
    baseRoleIds: [1, 2, 3, 4, 5, 6, 10, 8],
  },
  vicious_nobles: {
    label: 'Vicious Nobles',
    description: 'Assassin, Thief, Magician, Patrician, Cardinal, Trader, Architect, Warlord. No-holds-barred aggression.',
    baseRoleIds: [1, 2, 3, 11, 12, 13, 7, 8],
    rank9: {
      id: 14,
      label: 'Include Tax Collector (rank 9)',
      description: 'Every non-TC build donates 1 gold to the tax chest; the Tax Collector collects it on their turn.',
      defaultInclude: false,
    },
  },
};

// Resolve a config + toggle into the final list of role IDs.
export function resolveRoleIds(configKey, includeRank9) {
  const cfg = ROLE_CONFIGS[configKey];
  if (!cfg) return null;
  const ids = [...cfg.baseRoleIds];
  if (cfg.rank9 && includeRank9) ids.push(cfg.rank9.id);
  return ids;
}

// District color categories
export const DISTRICT_COLORS = {
  noble: { label: 'Noble', hex: '#f0c040' },
  religious: { label: 'Religious', hex: '#4488cc' },
  trade: { label: 'Trade', hex: '#44aa44' },
  military: { label: 'Military', hex: '#cc4444' },
  unique: { label: 'Unique', hex: '#aa66cc' },
};

// District card definitions (name, cost, color, count in deck)
export const DISTRICT_CARDS = [
  // Noble (yellow) - 12 cards
  { name: 'Manor', cost: 3, color: 'noble', count: 5 },
  { name: 'Castle', cost: 4, color: 'noble', count: 4 },
  { name: 'Palace', cost: 5, color: 'noble', count: 3 },

  // Religious (blue) - 12 cards
  { name: 'Temple', cost: 1, color: 'religious', count: 3 },
  { name: 'Church', cost: 2, color: 'religious', count: 3 },
  { name: 'Monastery', cost: 3, color: 'religious', count: 3 },
  { name: 'Cathedral', cost: 5, color: 'religious', count: 2 },

  // Trade (green) - 12 cards
  { name: 'Tavern', cost: 1, color: 'trade', count: 5 },
  { name: 'Market', cost: 2, color: 'trade', count: 4 },
  { name: 'Trading Post', cost: 2, color: 'trade', count: 3 },
  { name: 'Docks', cost: 3, color: 'trade', count: 3 },
  { name: 'Harbor', cost: 4, color: 'trade', count: 3 },
  { name: 'Town Hall', cost: 5, color: 'trade', count: 2 },

  // Military (red) - 12 cards
  { name: 'Watchtower', cost: 1, color: 'military', count: 3 },
  { name: 'Prison', cost: 2, color: 'military', count: 3 },
  { name: 'Battlefield', cost: 3, color: 'military', count: 3 },
  { name: 'Fortress', cost: 5, color: 'military', count: 2 },

  // Unique (purple) - 10 cards
  { name: 'Haunted Quarter', cost: 2, color: 'unique', count: 1, desc: 'Counts as any color for end-game bonus' },
  { name: 'Keep', cost: 3, color: 'unique', count: 2, desc: 'Cannot be destroyed by the Warlord' },
  { name: 'Laboratory', cost: 5, color: 'unique', count: 1, desc: 'Discard a card for 2 gold (once per turn)' },
  { name: 'Smithy', cost: 5, color: 'unique', count: 1, desc: 'Pay 2 gold to draw 3 cards (once per turn)' },
  { name: 'Graveyard', cost: 5, color: 'unique', count: 1, desc: 'Pay 1 gold to recover a destroyed district' },
  { name: 'Observatory', cost: 5, color: 'unique', count: 1, desc: 'Draw 3 cards instead of 2 (keep 1)' },
  { name: 'School of Magic', cost: 6, color: 'unique', count: 1, desc: 'Counts as any color for role bonuses' },
  { name: 'Library', cost: 6, color: 'unique', count: 1, desc: 'Keep both cards when drawing' },
  { name: 'Dragon Gate', cost: 6, color: 'unique', count: 1, desc: 'Worth 8 points at end of game' },
  { name: 'University', cost: 6, color: 'unique', count: 1, desc: 'Worth 8 points at end of game' },
];

// Game phases
export const PHASES = {
  WAITING: 'waiting',
  DRAFT: 'draft',
  TURNS: 'turns',
  GAME_OVER: 'game_over',
};

// Game constants
export const STARTING_GOLD = 2;
export const STARTING_CARDS = 4;
export const DISTRICTS_TO_WIN = 8;
export const INCOME_GOLD = 2;
export const DRAW_CARD_COUNT = 2;
export const KEEP_CARD_COUNT = 1;

// Socket events
export const EVENTS = {
  // Lobby
  CREATE_GAME: 'create-game',
  JOIN_GAME: 'join-game',
  GAME_CREATED: 'game-created',
  GAME_JOINED: 'game-joined',
  GAME_START: 'game-start',
  GAME_ERROR: 'game-error',
  GAME_RECONNECTED: 'game-reconnected',

  // Draft
  DRAFT_STATE: 'draft-state',
  DRAFT_PICK: 'draft-pick',

  // Turn
  GAME_STATE: 'game-state',
  TAKE_GOLD: 'take-gold',
  DRAW_CARDS: 'draw-cards',
  KEEP_CARD: 'keep-card',
  BUILD_DISTRICT: 'build-district',
  BUILD_WITH_CARDS: 'build-with-cards',
  COLLECT_TAX: 'collect-tax',
  USE_ABILITY: 'use-ability',
  END_TURN: 'end-turn',
  USE_LABORATORY: 'use-laboratory',
  USE_SMITHY: 'use-smithy',
  COLLECT_BONUS: 'collect-bonus',
  QUIT_GAME: 'quit-game',
  GAME_QUIT: 'game-quit',

  // Game over
  GAME_OVER: 'game-over',
};
