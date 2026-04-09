// Count districts matching a color, including School of Magic as a wildcard
function countColor(city, color) {
  let count = city.filter(d => d.color === color).length;
  if (city.some(d => d.name === 'School of Magic')) count += 1;
  return count;
}

export const roleAbilities = {
  // 1 - Assassin: name a role to kill (they skip their turn)
  1: {
    name: 'Assassin',
    needsTarget: 'role',
    validTargets: (game, playerId) => [2, 3, 4, 5, 6, 7, 8],
    execute: (game, playerId, params) => {
      const targetRoleId = params?.targetRoleId;
      if (typeof targetRoleId !== 'number' || targetRoleId < 2 || targetRoleId > 8) {
        return { error: 'Invalid target role' };
      }
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
    execute: (game, playerId, params) => {
      const targetRoleId = params?.targetRoleId;
      const valid = [3, 4, 5, 6, 7, 8].filter(id => id !== game.assassinatedRole);
      if (typeof targetRoleId !== 'number' || !valid.includes(targetRoleId)) {
        return { error: 'Invalid target role' };
      }
      game.stolenRole = targetRoleId;
      return { type: 'steal', targetRoleId };
    },
  },

  // 3 - Magician: swap hand with another player OR discard cards and draw new ones
  3: {
    name: 'Magician',
    needsTarget: 'magician_choice',
    execute: (game, playerId, params) => {
      const action = params?.action;
      const player = game.players[playerId];

      if (action === 'swap') {
        const targetPlayerId = params?.targetPlayerId;
        const target = game.players[targetPlayerId];
        if (!target || targetPlayerId === playerId) {
          return { error: 'Invalid target player' };
        }
        const tempHand = player.hand;
        player.hand = target.hand;
        target.hand = tempHand;
        return { type: 'magician_swap', targetPlayerId };
      }

      if (action === 'discard') {
        const cardIds = params?.cardIds;
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
          return { error: 'Must select cards to discard' };
        }
        // Validate all card IDs belong to player's hand
        const handIds = new Set(player.hand.map(c => c.id));
        for (const id of cardIds) {
          if (!handIds.has(id)) return { error: 'Card not in hand' };
        }
        const discardSet = new Set(cardIds);
        const discarded = [];
        player.hand = player.hand.filter(card => {
          if (discardSet.has(card.id)) {
            discarded.push(card);
            return false;
          }
          return true;
        });
        game.deck.push(...discarded);
        const drawn = game.deck.splice(0, discarded.length);
        player.hand.push(...drawn);
        return { type: 'magician_discard', count: discarded.length };
      }

      return { error: 'Invalid magician action' };
    },
  },

  // 4 - King: gets crown, +1 gold per noble district (passive)
  4: {
    name: 'King',
    needsTarget: null,
    execute: (game, playerId) => {
      game.crownHolder = playerId;
      const bonus = countColor(game.players[playerId].city, 'noble');
      game.players[playerId].gold += bonus;
      return { type: 'king', bonus };
    },
  },

  // 5 - Bishop: protected from warlord, +1 gold per religious district (passive)
  5: {
    name: 'Bishop',
    needsTarget: null,
    execute: (game, playerId) => {
      const bonus = countColor(game.players[playerId].city, 'religious');
      game.players[playerId].gold += bonus;
      return { type: 'bishop', bonus };
    },
  },

  // 6 - Merchant: +1 gold, +1 gold per trade district (passive)
  6: {
    name: 'Merchant',
    needsTarget: null,
    execute: (game, playerId) => {
      game.players[playerId].gold += 1;
      const bonus = countColor(game.players[playerId].city, 'trade');
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
      game.currentTurn.buildsRemaining = 3;
      return { type: 'architect', cardsDrawn: drawn.length };
    },
  },

  // 8 - Warlord: destroy a district (pay cost-1), +1 gold per military district
  8: {
    name: 'Warlord',
    needsTarget: 'district',
    optional: true,
    validTargets: (game, playerId) => {
      const targets = [];
      for (const [pid, player] of Object.entries(game.players)) {
        if (pid === playerId) continue;
        const hasBishop = player.roles && player.roles.some(r => r.id === 5);
        if (hasBishop && game.assassinatedRole !== 5) continue;
        if (player.city.length >= 8) continue;
        for (const district of player.city) {
          if (district.name === 'Keep') continue;
          if (game.players[playerId].gold >= district.cost - 1) {
            targets.push({ playerId: pid, districtId: district.id, cost: district.cost - 1 });
          }
        }
      }
      return targets;
    },
    execute: (game, playerId, params) => {
      const targetPlayerId = params?.targetPlayerId;
      const targetDistrictId = params?.targetDistrictId;

      if (targetPlayerId && targetDistrictId !== undefined) {
        // Validate target player exists and isn't self
        const target = game.players[targetPlayerId];
        if (!target || targetPlayerId === playerId) {
          return { type: 'warlord', destroyed: false, error: 'Invalid target' };
        }

        // Can't target bishop's city (unless assassinated)
        const hasBishop = target.roles && target.roles.some(r => r.id === 5);
        if (hasBishop && game.assassinatedRole !== 5) {
          return { type: 'warlord', destroyed: false, error: 'Bishop protected' };
        }

        // Can't target completed cities
        if (target.city.length >= 8) {
          return { type: 'warlord', destroyed: false, error: 'City is complete' };
        }

        const districtIndex = target.city.findIndex(d => d.id === targetDistrictId);
        if (districtIndex === -1) return { type: 'warlord', destroyed: false };
        const district = target.city[districtIndex];

        // Can't destroy Keep
        if (district.name === 'Keep') {
          return { type: 'warlord', destroyed: false, error: 'Cannot destroy Keep' };
        }

        const cost = district.cost - 1;

        // Must be able to afford
        if (game.players[playerId].gold < cost) {
          return { type: 'warlord', destroyed: false, error: 'Not enough gold' };
        }

        game.players[playerId].gold -= cost;
        target.city.splice(districtIndex, 1);

        // Graveyard: auto-recover
        const hasGraveyard = target.city.some(d => d.name === 'Graveyard');
        if (hasGraveyard && target.gold >= 1) {
          target.gold -= 1;
          target.hand.push(district);
          game._log(`Graveyard: paid 1 gold to recover ${district.name} to hand.`);
          return { type: 'warlord', destroyed: true, recovered: true, districtName: district.name, cost };
        }

        game.deck.push(district);
        return { type: 'warlord', destroyed: true, districtName: district.name, cost };
      }

      return { type: 'warlord', destroyed: false };
    },
  },
};
