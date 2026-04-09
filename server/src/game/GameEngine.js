import {
  PHASES,
  ROLE_LIST,
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
  constructor(gameId) {
    this.gameId = gameId;
    this.phase = PHASES.WAITING;
    this.players = {}; // { playerId: { gold, hand, city, roles, connected } }
    this.deck = [];
    this.crownHolder = null; // player who has the crown
    this.round = 0;

    // Draft state
    this.draftState = null;

    // Turn state
    this.currentTurn = null;
    this.turnOrder = []; // roles in order to be revealed
    this.turnIndex = 0;
    this.assassinatedRole = null;
    this.stolenRole = null;

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

    const allRoles = [...ROLE_LIST];
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
      otherPlayer: otherPlayer,
      action: 'pick', // 'pick' or 'discard'
      step: 0,
      // Steps (each player picks then discards):
      // 0: Crown player picks (from 7)
      // 1: Crown player discards (from 6)
      // 2: Other player picks (from 5)
      // 3: Other player discards (from 4)
      // 4: Crown player picks (from 3)
      // 5: Crown player discards (from 2)
      // 6: Other player gets last role (auto)
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
      // Player takes this role
      this.players[playerId].roles.push(role);
      // Now they must discard one
      ds.action = 'discard';
      ds.step++;
    } else {
      // Player discards this role
      ds.discarded.push(role);
      ds.action = 'pick';
      ds.step++;

      // Check if draft is complete
      if (ds.available.length === 1) {
        // Last role goes to other player automatically
        const lastRole = ds.available[0];
        const otherPid = Object.keys(this.players).find(p => p !== playerId);
        this.players[otherPid].roles.push(lastRole);
        ds.available = [];
        ds.step = 7;
        this.startTurnPhase();
        return { success: true };
      }

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

    // Build turn order: all 8 roles in order, only those that are held play
    this.turnOrder = ROLE_LIST.map(r => r.id);
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

      // Check if assassinated
      if (roleId === this.assassinatedRole) {
        const roleName = ROLE_LIST.find(r => r.id === roleId).name;
        this._log(`The ${roleName} was assassinated and loses their turn!`);
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
        maxBuilds: 1,
        drawnCards: null, // set when drawing cards
      };

      // Auto-execute passive abilities for king, bishop, merchant
      if ([4, 5, 6].includes(roleId)) {
        const ability = roleAbilities[roleId];
        const result = ability.execute(this, holder);
        this.currentTurn.hasUsedAbility = true;
        if (result.bonus > 0) {
          this._log(`The ${this.currentTurn.roleName} collects ${result.bonus} bonus gold from districts.`);
        }
        if (roleId === 4) {
          this._log(`The King takes the crown.`);
        }
      }

      // Architect: auto-execute (draw cards + set max builds)
      if (roleId === 7) {
        const ability = roleAbilities[roleId];
        ability.execute(this, holder);
        this.currentTurn.hasUsedAbility = true;
        this._log(`The Architect draws 2 extra cards and may build up to 3 districts.`);
      }

      // Warlord: auto-collect military district bonus (destroy is still manual)
      if (roleId === 8) {
        const bonus = this.players[holder].city.filter(d => d.color === 'military').length;
        this.players[holder].gold += bonus;
        if (bonus > 0) {
          this._log(`The Warlord collects ${bonus} bonus gold from military districts.`);
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

    const drawn = this.deck.splice(0, DRAW_CARD_COUNT);
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

  buildDistrict(playerId, cardId) {
    if (!this._validateTurn(playerId)) return { error: 'Not your turn' };
    if (!this.currentTurn.hasTakenIncome) return { error: 'Must take income first' };
    if (this.currentTurn.drawnCards) return { error: 'Must choose a card first' };
    if (this.currentTurn.buildsRemaining <= 0) return { error: 'No builds remaining' };

    const player = this.players[playerId];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    const card = player.hand[cardIndex];

    // Check if already built same district
    if (player.city.some(d => d.name === card.name)) {
      return { error: 'Already built this district' };
    }

    if (player.gold < card.cost) return { error: 'Not enough gold' };

    player.gold -= card.cost;
    player.hand.splice(cardIndex, 1);
    player.city.push(card);
    this.currentTurn.buildsRemaining--;

    this._log(`The ${this.currentTurn.roleName} builds ${card.name} for ${card.cost} gold.`);

    // Check for game end trigger
    if (player.city.length >= DISTRICTS_TO_WIN && !this.firstToComplete) {
      this.firstToComplete = playerId;
      this.finalRound = true;
      this._log(`${card.name} completes their city! Final round!`);
    }

    return { success: true, district: card };
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

      // Sum district costs
      score += player.city.reduce((sum, d) => sum + d.cost, 0);

      // First to 8 districts: +4
      if (pid === this.firstToComplete) score += 4;
      // Others with 8 districts: +2
      else if (player.city.length >= DISTRICTS_TO_WIN) score += 2;

      // All 5 colors: +3
      const colors = new Set(player.city.map(d => d.color));
      if (colors.size >= 5) score += 3;

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

      // New log events since last state push
      newEvents: this._getNewEvents(playerId),
    };

    // Draft state
    if (this.phase === PHASES.DRAFT && this.draftState) {
      state.draft = this.getDraftView(playerId);
    }

    // Turn state
    if (this.phase === PHASES.TURNS && this.currentTurn) {
      state.turn = {
        playerId: this.currentTurn.playerId,
        roleId: this.currentTurn.roleId,
        roleName: this.currentTurn.roleName,
        isMyTurn: this.currentTurn.playerId === playerId,
        hasTakenIncome: this.currentTurn.hasTakenIncome,
        hasUsedAbility: this.currentTurn.hasUsedAbility,
        buildsRemaining: this.currentTurn.buildsRemaining,
        drawnCards: this.currentTurn.playerId === playerId ? this.currentTurn.drawnCards : null,
      };

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
