// Role ability implementations
// Each returns an object describing the result of the ability

export const roleAbilities = {
  // 1 - Assassin: name a role to kill (they skip their turn)
  1: {
    name: 'Assassin',
    needsTarget: 'role', // target is a role id (2-8)
    validTargets: (game, playerId) => [2, 3, 4, 5, 6, 7, 8],
    execute: (game, playerId, { targetRoleId }) => {
      game.assassinatedRole = targetRoleId;
      return { type: 'assassinate', targetRoleId };
    },
  },

  // 2 - Thief: name a role to steal gold from (can't target assassin or assassinated)
  2: {
    name: 'Thief',
    needsTarget: 'role',
    validTargets: (game, playerId) => {
      return [3, 4, 5, 6, 7, 8].filter(id => id !== game.assassinatedRole);
    },
    execute: (game, playerId, { targetRoleId }) => {
      game.stolenRole = targetRoleId;
      return { type: 'steal', targetRoleId };
    },
  },

  // 3 - Magician: swap hand with another player OR discard cards and draw new ones
  3: {
    name: 'Magician',
    needsTarget: 'magician_choice',
    execute: (game, playerId, { action, targetPlayerId, cardIds }) => {
      const player = game.players[playerId];

      if (action === 'swap') {
        const target = game.players[targetPlayerId];
        const tempHand = player.hand;
        player.hand = target.hand;
        target.hand = tempHand;
        return { type: 'magician_swap', targetPlayerId };
      }

      if (action === 'discard') {
        // Discard selected cards and draw same number
        const discarded = [];
        player.hand = player.hand.filter(card => {
          if (cardIds.includes(card.id)) {
            discarded.push(card);
            return false;
          }
          return true;
        });
        // Put discarded cards at bottom of deck
        game.deck.push(...discarded);
        // Draw replacement cards
        const drawn = game.deck.splice(0, discarded.length);
        player.hand.push(...drawn);
        return { type: 'magician_discard', count: discarded.length };
      }
    },
  },

  // 4 - King: gets crown, +1 gold per noble district (passive)
  4: {
    name: 'King',
    needsTarget: null,
    execute: (game, playerId) => {
      game.crownHolder = playerId;
      const bonus = game.players[playerId].city.filter(d => d.color === 'noble').length;
      game.players[playerId].gold += bonus;
      return { type: 'king', bonus };
    },
  },

  // 5 - Bishop: protected from warlord, +1 gold per religious district (passive)
  5: {
    name: 'Bishop',
    needsTarget: null,
    execute: (game, playerId) => {
      const bonus = game.players[playerId].city.filter(d => d.color === 'religious').length;
      game.players[playerId].gold += bonus;
      return { type: 'bishop', bonus };
    },
  },

  // 6 - Merchant: +1 gold, +1 gold per trade district (passive)
  6: {
    name: 'Merchant',
    needsTarget: null,
    execute: (game, playerId) => {
      game.players[playerId].gold += 1; // extra gold
      const bonus = game.players[playerId].city.filter(d => d.color === 'trade').length;
      game.players[playerId].gold += bonus;
      return { type: 'merchant', bonus: bonus + 1 };
    },
  },

  // 7 - Architect: draw 2 extra cards, can build up to 3 districts this turn
  7: {
    name: 'Architect',
    needsTarget: null,
    execute: (game, playerId) => {
      const drawn = game.deck.splice(0, 2);
      game.players[playerId].hand.push(...drawn);
      game.currentTurn.maxBuilds = 3;
      return { type: 'architect', cardsDrawn: drawn.length };
    },
  },

  // 8 - Warlord: destroy a district (pay cost-1), +1 gold per military district
  8: {
    name: 'Warlord',
    needsTarget: 'district',
    optional: true, // warlord can choose not to destroy
    validTargets: (game, playerId) => {
      const targets = [];
      for (const [pid, player] of Object.entries(game.players)) {
        if (pid === playerId) continue;
        // Can't target bishop's city (unless bishop was assassinated)
        const hasBishop = player.roles && player.roles.some(r => r.id === 5);
        if (hasBishop && game.assassinatedRole !== 5) continue;
        // Can't destroy completed cities (8 districts)
        if (player.city.length >= 8) continue;
        for (const district of player.city) {
          // Can't destroy Keep
          if (district.name === 'Keep') continue;
          // Must be able to afford (cost - 1)
          if (game.players[playerId].gold >= district.cost - 1) {
            targets.push({ playerId: pid, districtId: district.id, cost: district.cost - 1 });
          }
        }
      }
      return targets;
    },
    execute: (game, playerId, { targetPlayerId, targetDistrictId }) => {
      // Military bonus is auto-applied in _advanceToNextRole
      if (targetPlayerId && targetDistrictId !== undefined) {
        const target = game.players[targetPlayerId];
        const districtIndex = target.city.findIndex(d => d.id === targetDistrictId);
        if (districtIndex === -1) return { type: 'warlord', destroyed: false };
        const district = target.city[districtIndex];
        const cost = district.cost - 1;
        game.players[playerId].gold -= cost;
        target.city.splice(districtIndex, 1);
        game.deck.push(district);
        return { type: 'warlord', destroyed: true, districtName: district.name, cost };
      }

      return { type: 'warlord', destroyed: false };
    },
  },
};
