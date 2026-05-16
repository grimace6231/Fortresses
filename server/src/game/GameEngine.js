import {
  PHASES,
  ROLES,
  ROLE_LIST,
  ROLE_CONFIGS,
  resolveRoleIds,
  STARTING_GOLD,
  STARTING_CARDS,
  DISTRICTS_TO_WIN,
  INCOME_GOLD,
  DRAW_CARD_COUNT,
  KEEP_CARD_COUNT,
} from '../../../shared/constants.js';
import { createDeck, shuffle } from './districts.js';
import { roleAbilities } from './roles.js';

export class GameEngine {
  constructor(gameId, settings = {}) {
    this.gameId = gameId;
    this.phase = PHASES.WAITING;
    this.players = {}; // { playerId: { gold, hand, city, roles, connected } }
    this.deck = [];
    this.crownHolder = null; // player who has the crown
    this.round = 0;

    // Which roles are in play this game. The client sends configKey + an
    // includeRank9 toggle (for scenarios that offer a rank-9 character).
    const configKey = settings.configKey && ROLE_CONFIGS[settings.configKey]
      ? settings.configKey
      : 'classic';
    const cfg = ROLE_CONFIGS[configKey];
    const includeRank9 = cfg.rank9
      ? (settings.includeRank9 ?? cfg.rank9.defaultInclude)
      : false;
    this.settings = { configKey, includeRank9 };
    this.roleIds = resolveRoleIds(configKey, includeRank9);
    this.activeRoles = ROLE_LIST.filter(r => this.roleIds.includes(r.id));

    // Draft state
    this.draftState = null;

    // Turn state
    this.currentTurn = null;
    this.turnOrder = []; // roles in order to be revealed
    this.turnIndex = 0;
    this.assassinatedRole = null;
    this.stolenRole = null;

    // Tax Collector stash (persists across rounds even when TC not in play).
    // Only meaningful when role 14 is in this.roleIds.
    this.taxGold = 0;

    // End game
    this.firstToComplete = null;
    this.finalRound = false;

    // Event log — each entry: { message, forPlayer: 'all' | playerId }
    this.eventLog = [];
    this._lastSentLogIndex = {};
  }

  _log(message, forPlayer = 'all') {
    this.eventLog.push({ message, forPlayer });
  }

  _getNewEvents(playerId) {
    const lastIndex = this._lastSentLogIndex[playerId] || 0;
    const events = this.eventLog
      .slice(lastIndex)
      .filter(e => e.forPlayer === 'all' || e.forPlayer === playerId)
      .map(e => e.message);
    this._lastSentLogIndex[playerId] = this.eventLog.length;
    return events;
  }

  addPlayer(playerId) {
    if (Object.keys(this.players).length >= 2) return false;
    this.players[playerId] = {
      gold: 0,
      hand: [],
      city: [],
      roles: [],
      connected: true,
    };
    return true;
  }

  start() {
    const playerIds = Object.keys(this.players);
    if (playerIds.length !== 2) return false;

    this.deck = createDeck();

    // Deal starting cards and gold
    for (const pid of playerIds) {
      this.players[pid].gold = STARTING_GOLD;
      this.players[pid].hand = this.deck.splice(0, STARTING_CARDS);
    }

    // First player gets crown randomly
    this.crownHolder = playerIds[Math.floor(Math.random() * 2)];

    this.startDraftPhase();
    return true;
  }

  // ── Draft Phase ──

  startDraftPhase() {
    this.phase = PHASES.DRAFT;
    this.round++;
    this.assassinatedRole = null;
    this.stolenRole = null;

    // Reset roles
    for (const p of Object.values(this.players)) {
      p.roles = [];
    }

    const allRoles = [...this.activeRoles];
    const shuffled = shuffle(allRoles);

    // 2-player draft:
    // 1. Remove 1 face-down randomly (hidden)
    const faceDown = shuffled.pop();

    const playerIds = Object.keys(this.players);
    const crownPlayer = this.crownHolder;
    const otherPlayer = playerIds.find(p => p !== crownPlayer);

    this.draftState = {
      available: shuffled, // 7 remaining roles
      faceDown: [faceDown],
      discarded: [],
      currentPicker: crownPlayer,
      action: 'pick', // 'pick' or 'discard'
      firstTurn: true, // first turn = pick only, no discard
      // Flow:
      // Crown player: pick only (first turn, 7→6)
      // Other player: pick + discard (6→4)
      // Crown player: pick + discard (4→2)
      // Other player: pick (2→1), last auto-assigned to crown
    };

    return this.getDraftView();
  }

  draftPick(playerId, roleId) {
    const ds = this.draftState;
    if (!ds) return { error: 'No draft in progress' };
    if (playerId !== ds.currentPicker) return { error: 'Not your turn' };

    const roleIndex = ds.available.findIndex(r => r.id === roleId);
    if (roleIndex === -1) return { error: 'Role not available' };

    const role = ds.available.splice(roleIndex, 1)[0];

    if (ds.action === 'pick') {
      this.players[playerId].roles.push(role);

      const everyoneHasTwo = Object.values(this.players).every(p => p.roles.length >= 2);

      if (everyoneHasTwo) {
        // Draft done — auto-discard remaining roles face up
        ds.discarded.push(...ds.available);
        ds.available = [];
        this.startTurnPhase();
      } else if (ds.firstTurn) {
        // First turn: pick only, no discard — switch to other player
        ds.firstTurn = false;
        ds.currentPicker = Object.keys(this.players).find(p => p !== playerId);
      } else if (ds.available.length === 1) {
        // Only one role left — auto-discard and end draft
        ds.discarded.push(ds.available[0]);
        ds.available = [];
        this.startTurnPhase();
      } else {
        // Must discard one now
        ds.action = 'discard';
      }
    } else {
      // Player discards this role
      ds.discarded.push(role);
      ds.action = 'pick';

      // Switch to other player
      ds.currentPicker = ds.currentPicker === this.crownHolder
        ? Object.keys(this.players).find(p => p !== this.crownHolder)
        : this.crownHolder;
    }

    return { success: true };
  }

  getDraftView(forPlayerId) {
    const ds = this.draftState;
    if (!ds) return null;

    return {
      available: ds.currentPicker === forPlayerId ? ds.available : ds.available.map(() => null),
      availableIds: ds.available.map(r => r.id), // public: which role ids are still in the pool
      discarded: ds.discarded, // public: face-up discards
      allRoleIds: this.roleIds, // all roles in play this game
      currentPicker: ds.currentPicker,
      action: ds.action,
      step: ds.step,
      myRoles: forPlayerId ? this.players[forPlayerId].roles : [],
    };
  }

  // ── Turn Phase ──

  startTurnPhase() {
    this.phase = PHASES.TURNS;
    this.draftState = null;

    // Build turn order by rank. Multiple roles can share a rank but configs
    // only ever include one role per rank, so ordering is unambiguous.
    this.turnOrder = [...this.activeRoles]
      .sort((a, b) => a.rank - b.rank)
      .map(r => r.id);
    this.turnIndex = 0;

    this._advanceToNextRole();
  }

  _advanceToNextRole() {
    while (this.turnIndex < this.turnOrder.length) {
      const roleId = this.turnOrder[this.turnIndex];

      // Find who has this role
      const holder = this._findRoleHolder(roleId);
      if (!holder) {
        this.turnIndex++;
        continue;
      }

      // King/Patrician always take the crown, even if assassinated
      if (roleId === 4 || roleId === 11) {
        this.crownHolder = holder;
      }

      // Check if assassinated
      if (roleId === this.assassinatedRole) {
        const roleName = ROLE_LIST.find(r => r.id === roleId).name;
        this._log(`The ${roleName} was assassinated and loses their turn!`);
        if (roleId === 4 || roleId === 11) {
          this._log(`The ${roleName} still takes the crown.`);
        }
        this.turnIndex++;
        continue;
      }

      // Check if stolen from — transfer gold
      if (roleId === this.stolenRole) {
        const thiefHolder = this._findRoleHolder(2);
        if (thiefHolder) {
          const stolen = this.players[holder].gold;
          this.players[holder].gold = 0;
          this.players[thiefHolder].gold += stolen;
          const roleName = ROLE_LIST.find(r => r.id === roleId).name;
          this._log(`The Thief steals ${stolen} gold from the ${roleName}!`);
        }
      }

      // Set up this turn
      this.currentTurn = {
        playerId: holder,
        roleId: roleId,
        roleName: ROLE_LIST.find(r => r.id === roleId).name,
        hasUsedAbility: false,
        hasTakenIncome: false,
        buildsRemaining: 1,
        drawnCards: null, // set when drawing cards
      };

      // Crown / role-specific openers
      if (roleId === 4) {
        this._log(`The King takes the crown.`);
      }
      if (roleId === 11) {
        this._log(`The Patrician takes the crown.`);
        this.currentTurn.buildsRemaining = 2;
      }
      if (roleId === 6) {
        this.players[holder].gold += 1;
        this._log(`The Merchant receives 1 extra gold.`);
      }

      // Generic color-bonus arming: any role with a bonus config can collect it
      const roleDef = ROLE_LIST.find(r => r.id === roleId);
      if (roleDef?.bonus) {
        this.currentTurn.hasCollectedBonus = false;
      }

      // Tax Collector: auto-collect accumulated tax at turn start
      if (roleId === 14) {
        if (this.taxGold > 0) {
          this.players[holder].gold += this.taxGold;
          this._log(`The Tax Collector collects ${this.taxGold} gold from the tax chest.`);
          this.taxGold = 0;
        } else {
          this._log(`The Tax Collector finds the tax chest empty.`);
        }
        this.currentTurn.hasUsedAbility = true;
      }

      // Architect: auto-execute (draw cards + set max builds)
      if (roleId === 7) {
        const ability = roleAbilities[roleId];
        ability.execute(this, holder);
        this.currentTurn.hasUsedAbility = true;
        this._log(`The Architect draws 2 extra cards and may build up to 3 districts.`);
      }

      // Scholar: auto-execute (draw 7, keep 1 via existing keepCard flow).
      // This replaces the normal income/draw action for the turn.
      if (roleId === 10) {
        const drawn = this.deck.splice(0, 7);
        this.currentTurn.drawnCards = drawn;
        this.currentTurn.hasTakenIncome = true;
        this.currentTurn.hasUsedAbility = true;
        this._log(`The Scholar draws ${drawn.length} cards and keeps 1.`);
      }

      // Queen: auto-execute (+3 gold if the other player holds the crown)
      if (roleId === 9) {
        const ability = roleAbilities[roleId];
        const result = ability.execute(this, holder);
        this.currentTurn.hasUsedAbility = true;
        if (result.bonus > 0) {
          this._log(`The Queen sits beside the Crown and collects ${result.bonus} gold.`);
        } else {
          this._log(`The Queen holds the Crown herself and collects no bonus.`);
        }
      }

      return;
    }

    // All roles resolved — check for game end or start new round
    this._endRound();
  }

  _findRoleHolder(roleId) {
    for (const [pid, player] of Object.entries(this.players)) {
      if (player.roles.some(r => r.id === roleId)) return pid;
    }
    return null;
  }

  // ── Player Actions ──

  takeGold(playerId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.hasTakenIncome) return { error: 'Already took income' };

    this.players[playerId].gold += INCOME_GOLD;
    this.currentTurn.hasTakenIncome = true;
    return { success: true, gold: INCOME_GOLD };
  }

  drawCards(playerId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.hasTakenIncome) return { error: 'Already took income' };

    // Observatory: draw 3 instead of 2
    const hasObservatory = this.players[playerId].city.some(d => d.name === 'Observatory');
    const drawCount = hasObservatory ? 3 : DRAW_CARD_COUNT;
    const drawn = this.deck.splice(0, drawCount);

    // Library: keep all cards, skip the choose step
    const hasLibrary = this.players[playerId].city.some(d => d.name === 'Library');
    if (hasLibrary) {
      this.players[playerId].hand.push(...drawn);
      this.currentTurn.hasTakenIncome = true;
      this._log(`Library lets the ${this.currentTurn.roleName} keep all ${drawn.length} drawn cards.`);
      return { success: true, cards: drawn, keptAll: true };
    }

    this.currentTurn.drawnCards = drawn;
    this.currentTurn.hasTakenIncome = true;
    return { success: true, cards: drawn };
  }

  keepCard(playerId, cardId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (!this.currentTurn.drawnCards) return { error: 'No cards to choose from' };

    const chosen = this.currentTurn.drawnCards.find(c => c.id === cardId);
    if (!chosen) return { error: 'Card not in drawn set' };

    // Keep chosen card, return others to bottom of deck
    this.players[playerId].hand.push(chosen);
    const returned = this.currentTurn.drawnCards.filter(c => c.id !== cardId);
    this.deck.push(...returned);
    this.currentTurn.drawnCards = null;

    return { success: true, card: chosen };
  }

  // Laboratory: discard a card from hand to gain 2 gold (once per turn)
  useLaboratory(playerId, cardId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.usedLaboratory) return { error: 'Already used Laboratory this turn' };

    const player = this.players[playerId];
    if (!player.city.some(d => d.name === 'Laboratory')) return { error: 'No Laboratory built' };

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    const card = player.hand.splice(cardIndex, 1)[0];
    this.deck.push(card);
    player.gold += 2;
    this.currentTurn.usedLaboratory = true;
    this._log(`Laboratory: discarded ${card.name} for 2 gold.`);

    return { success: true };
  }

  // Smithy: pay 2 gold to draw 3 cards (once per turn)
  useSmithy(playerId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.usedSmithy) return { error: 'Already used Smithy this turn' };

    const player = this.players[playerId];
    if (!player.city.some(d => d.name === 'Smithy')) return { error: 'No Smithy built' };
    if (player.gold < 2) return { error: 'Not enough gold (need 2)' };

    player.gold -= 2;
    const drawn = this.deck.splice(0, 3);
    player.hand.push(...drawn);
    this.currentTurn.usedSmithy = true;
    this._log(`Smithy: paid 2 gold to draw ${drawn.length} cards.`);

    return { success: true };
  }

  // Collect color bonus (any role with a `bonus` config). Resource may be
  // 'gold' or 'card'.
  collectBonus(playerId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.hasCollectedBonus === undefined) return { error: 'No color bonus for this role' };
    if (this.currentTurn.hasCollectedBonus) return { error: 'Already collected bonus' };

    const roleDef = ROLE_LIST.find(r => r.id === this.currentTurn.roleId);
    if (!roleDef?.bonus) return { error: 'No color bonus for this role' };
    const { color, resource } = roleDef.bonus;

    const player = this.players[playerId];
    let bonus = player.city.filter(d => d.color === color).length;
    if (player.city.some(d => d.name === 'School of Magic')) bonus += 1;

    if (resource === 'card') {
      const drawn = this.deck.splice(0, bonus);
      player.hand.push(...drawn);
      bonus = drawn.length;
    } else {
      player.gold += bonus;
    }
    this.currentTurn.hasCollectedBonus = true;

    const colorLabel = color.charAt(0).toUpperCase() + color.slice(1);
    const unit = resource === 'card' ? (bonus === 1 ? 'card' : 'cards') : 'gold';
    if (bonus > 0) {
      this._log(`The ${this.currentTurn.roleName} collects ${bonus} bonus ${unit} from ${colorLabel} districts.`);
    } else {
      this._log(`The ${this.currentTurn.roleName} has no ${colorLabel} districts to collect from.`);
    }

    return { success: true, bonus, resource };
  }

  buildDistrict(playerId, cardId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (!this.currentTurn.hasTakenIncome) return { error: 'Must take income first' };
    if (this.currentTurn.drawnCards) return { error: 'Must choose a card first' };

    const player = this.players[playerId];

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const isTrader = this.currentTurn.roleId === 13;
    const tradeFreebie = isTrader && card.color === 'trade';

    // Trade builds for the Trader bypass the single-build slot. Non-trade
    // builds still consume it.
    if (!tradeFreebie && this.currentTurn.buildsRemaining <= 0) {
      return { error: 'No builds remaining' };
    }

    // Check if already built same district
    if (player.city.some(d => d.name === card.name)) {
      return { error: 'Already built this district' };
    }

    if (player.gold < card.cost) return { error: 'Not enough gold' };

    player.gold -= card.cost;
    player.hand.splice(cardIndex, 1);
    player.city.push(card);
    if (!tradeFreebie) this.currentTurn.buildsRemaining--;

    this._log(`The ${this.currentTurn.roleName} builds ${card.name} for ${card.cost} gold.`);

    this._applyTaxOnBuild(playerId);

    // Check for game end trigger
    if (player.city.length >= DISTRICTS_TO_WIN && !this.firstToComplete) {
      this.firstToComplete = playerId;
      this.finalRound = true;
      this._log(`A city has been completed with ${card.name}! Final round!`);
    }

    return { success: true, district: card };
  }

  // Cardinal: pay for a build by trading cards 1:1 with the opponent instead
  // of (or in addition to) gold. Each card given to the opponent counts as 1
  // gold toward the build cost. Gold = gold paid from stash; cardIds = cards
  // handed to the opponent (which they keep).
  buildWithCards(playerId, { cardId, cardIds = [], goldPaid = 0 } = {}) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.roleId !== 12) return { error: 'Only the Cardinal can build with cards' };
    if (!this.currentTurn.hasTakenIncome) return { error: 'Must take income first' };
    if (this.currentTurn.drawnCards) return { error: 'Must choose a card first' };
    if (this.currentTurn.buildsRemaining <= 0) return { error: 'No builds remaining' };

    const player = this.players[playerId];
    const opponentId = Object.keys(this.players).find(p => p !== playerId);
    const opponent = this.players[opponentId];

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };
    const card = player.hand[cardIndex];

    if (player.city.some(d => d.name === card.name)) {
      return { error: 'Already built this district' };
    }
    if (!Array.isArray(cardIds) || cardIds.includes(cardId)) {
      return { error: 'Invalid payment cards' };
    }
    if (goldPaid < 0 || goldPaid > player.gold) return { error: 'Invalid gold amount' };
    if (goldPaid + cardIds.length !== card.cost) {
      return { error: 'Payment must equal district cost' };
    }
    if (cardIds.length > opponent.gold) {
      return { error: 'Opponent does not have enough gold to trade' };
    }

    // Collect the payment cards from hand
    const handIds = new Set(player.hand.map(c => c.id));
    for (const id of cardIds) {
      if (!handIds.has(id) || id === cardId) return { error: 'Payment card not in hand' };
    }
    const payIdSet = new Set(cardIds);
    const payCards = player.hand.filter(c => payIdSet.has(c.id));

    // Transfer: gold from opponent to cardinal-as-shortfall goes straight to
    // the build; cards move cardinal -> opponent.
    player.hand = player.hand.filter(c => !payIdSet.has(c.id) && c.id !== cardId);
    opponent.hand.push(...payCards);
    opponent.gold -= cardIds.length;
    player.gold -= goldPaid;
    player.city.push(card);
    this.currentTurn.buildsRemaining--;

    this._log(
      `The Cardinal builds ${card.name} (${goldPaid} gold + ${cardIds.length} card${cardIds.length === 1 ? '' : 's'} traded to opponent).`
    );

    this._applyTaxOnBuild(playerId);

    if (player.city.length >= DISTRICTS_TO_WIN && !this.firstToComplete) {
      this.firstToComplete = playerId;
      this.finalRound = true;
      this._log(`A city has been completed with ${card.name}! Final round!`);
    }

    return { success: true, district: card };
  }

  // Tax Collector side-effect: whenever any player other than the TC builds
  // a district, 1 gold moves from the builder's stash to the tax chest (if
  // they have any gold to give).
  _applyTaxOnBuild(builderId) {
    if (!this.roleIds?.includes(14)) return;
    if (this.currentTurn.roleId === 14) return; // TC is not taxed
    const builder = this.players[builderId];
    if (builder.gold <= 0) return;
    builder.gold -= 1;
    this.taxGold += 1;
    this._log(`Tax Collector claims 1 gold from ${this.currentTurn.roleName}'s build.`);
  }

  useAbility(playerId, params) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (this.currentTurn.hasUsedAbility) return { error: 'Already used ability' };

    const roleId = this.currentTurn.roleId;
    const ability = roleAbilities[roleId];
    if (!ability) return { error: 'No ability for this role' };

    // Assassin and Thief can use ability before income
    // Warlord uses ability after (optional)
    // Magician can use before or after income

    const result = ability.execute(this, playerId, params);
    if (result?.error) return { error: result.error };
    this.currentTurn.hasUsedAbility = true;

    // Log ability usage
    const roleName = this.currentTurn.roleName;
    if (result.type === 'assassinate') {
      const targetName = ROLE_LIST.find(r => r.id === result.targetRoleId).name;
      this._log(`The Assassin targets the ${targetName}!`);
    } else if (result.type === 'steal') {
      const targetName = ROLE_LIST.find(r => r.id === result.targetRoleId).name;
      this._log(`The Thief targets the ${targetName}!`);
    } else if (result.type === 'magician_swap') {
      this._log(`The Magician swaps hands with the opponent!`);
    } else if (result.type === 'magician_discard') {
      this._log(`The Magician discards ${result.count} card(s) and draws new ones.`);
    } else if (result.type === 'warlord' && result.destroyed) {
      this._log(`The Warlord destroys ${result.districtName} for ${result.cost} gold!`);
    }

    return { success: true, result };
  }

  endTurn(playerId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (!this.currentTurn.hasTakenIncome) return { error: 'Must take income first' };
    if (this.currentTurn.drawnCards) return { error: 'Must choose a card first' };

    this.turnIndex++;
    this._advanceToNextRole();
    return { success: true };
  }

  _validateTurn(playerId) {
    return (
      this.phase === PHASES.TURNS &&
      this.currentTurn &&
      this.currentTurn.playerId === playerId
    );
  }

  // ── Round End ──

  _endRound() {
    if (this.finalRound) {
      this._endGame();
      return;
    }
    this.startDraftPhase();
  }

  // ── Game Over ──

  _endGame() {
    this.phase = PHASES.GAME_OVER;

    const scores = {};
    for (const [pid, player] of Object.entries(this.players)) {
      let score = 0;

      // Sum district costs (Dragon Gate & University score 8 instead of 6)
      for (const d of player.city) {
        if (d.name === 'Dragon Gate' || d.name === 'University') {
          score += 8;
        } else {
          score += d.cost;
        }
      }

      // First to 8 districts: +4
      if (pid === this.firstToComplete) score += 4;
      // Others with 8 districts: +2
      else if (player.city.length >= DISTRICTS_TO_WIN) score += 2;

      // All 5 colors: +3
      // Haunted Quarter counts as any ONE missing color for this bonus
      const colors = new Set(player.city.map(d => d.color));
      const hasHauntedQuarter = player.city.some(d => d.name === 'Haunted Quarter');
      const allColors = ['noble', 'religious', 'trade', 'military', 'unique'];
      const missingCount = allColors.filter(c => !colors.has(c)).length;

      if (colors.size >= 5) {
        // Already have all 5 colors naturally
        score += 3;
      } else if (hasHauntedQuarter && missingCount === 1) {
        // Haunted Quarter fills the one missing color
        score += 3;
      }

      scores[pid] = score;
    }

    this.scores = scores;
    this.winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ── State Views ──

  getStateForPlayer(playerId) {
    const opponentId = Object.keys(this.players).find(p => p !== playerId);
    const player = this.players[playerId];
    const opponent = this.players[opponentId];

    const state = {
      gameId: this.gameId,
      phase: this.phase,
      round: this.round,
      crownHolder: this.crownHolder,
      myId: playerId,
      opponentId,

      // My info (full)
      me: {
        gold: player.gold,
        hand: player.hand,
        city: player.city,
        roles: player.roles,
      },

      // Opponent info (hidden hand/roles)
      opponent: {
        gold: opponent.gold,
        handCount: opponent.hand.length,
        city: opponent.city,
        roleCount: opponent.roles.length,
      },

      deckCount: this.deck.length,

      // Tax Collector chest (null when TC not in this config)
      taxGold: this.roleIds.includes(14) ? this.taxGold : null,

      // New log events since last state push
      newEvents: this._getNewEvents(playerId),
    };

    // Draft state
    if (this.phase === PHASES.DRAFT && this.draftState) {
      state.draft = this.getDraftView(playerId);
    }

    // Turn state
    if (this.phase === PHASES.TURNS && this.currentTurn) {
      const turnRoleDef = ROLE_LIST.find(r => r.id === this.currentTurn.roleId);
      state.turn = {
        playerId: this.currentTurn.playerId,
        roleId: this.currentTurn.roleId,
        roleName: this.currentTurn.roleName,
        isMyTurn: this.currentTurn.playerId === playerId,
        hasTakenIncome: this.currentTurn.hasTakenIncome,
        hasUsedAbility: this.currentTurn.hasUsedAbility,
        buildsRemaining: this.currentTurn.buildsRemaining,
        drawnCards: this.currentTurn.playerId === playerId ? this.currentTurn.drawnCards : null,
        hasCollectedBonus: this.currentTurn.hasCollectedBonus,
        bonusColor: turnRoleDef?.bonus?.color || null,
        bonusResource: turnRoleDef?.bonus?.resource || null,
        tradeFreeBuilds: this.currentTurn.roleId === 13,
        canBuildWithCards: this.currentTurn.roleId === 12,
      };

      // Building abilities available this turn
      if (state.turn.isMyTurn) {
        const city = player.city;
        state.turn.canUseLaboratory = city.some(d => d.name === 'Laboratory')
          && !this.currentTurn.usedLaboratory && player.hand.length > 0;
        state.turn.canUseSmithy = city.some(d => d.name === 'Smithy')
          && !this.currentTurn.usedSmithy && player.gold >= 2;
      }

      // Provide valid ability targets if it's this player's turn
      if (state.turn.isMyTurn && !this.currentTurn.hasUsedAbility) {
        const ability = roleAbilities[this.currentTurn.roleId];
        if (ability && ability.validTargets) {
          state.turn.abilityTargets = ability.validTargets(this, playerId);
        }
        if (ability) {
          state.turn.abilityType = ability.needsTarget;
          state.turn.abilityOptional = ability.optional || false;
        }
      }
    }

    // Game over
    if (this.phase === PHASES.GAME_OVER) {
      state.scores = this.scores;
      state.winner = this.winner;
      // Reveal all roles
      state.opponent.roles = opponent.roles;
    }

    return state;
  }
}
