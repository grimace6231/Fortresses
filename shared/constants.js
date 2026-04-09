// Role definitions
export const ROLES = {
  ASSASSIN: { id: 1, name: 'Assassin', color: null },
  THIEF: { id: 2, name: 'Thief', color: null },
  MAGICIAN: { id: 3, name: 'Magician', color: null },
  KING: { id: 4, name: 'King', color: 'noble' },
  BISHOP: { id: 5, name: 'Bishop', color: 'religious' },
  MERCHANT: { id: 6, name: 'Merchant', color: 'trade' },
  ARCHITECT: { id: 7, name: 'Architect', color: null },
  WARLORD: { id: 8, name: 'Warlord', color: 'military' },
};

export const ROLE_LIST = Object.values(ROLES).sort((a, b) => a.id - b.id);

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
  USE_ABILITY: 'use-ability',
  END_TURN: 'end-turn',
  USE_LABORATORY: 'use-laboratory',
  USE_SMITHY: 'use-smithy',
  QUIT_GAME: 'quit-game',
  GAME_QUIT: 'game-quit',

  // Game over
  GAME_OVER: 'game-over',
};
