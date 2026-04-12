import { useState } from 'react';
import { EVENTS, ROLE_LIST } from '../../../shared/constants.js';

const ROLE_DESCRIPTIONS = {
  1: 'Kill a role — they skip their turn',
  2: 'Steal gold from a role',
  3: 'Swap hands or discard & redraw',
  4: 'Take crown. +1 gold per noble district',
  5: 'Protected from Warlord. +1 gold per religious district',
  6: '+1 extra gold. +1 gold per trade district',
  7: 'Draw 2 extra cards. Build up to 3 districts',
  8: 'Destroy a district. +1 gold per military district',
};

export function ActionPanel({ gameState, emit, onWarlordTarget, setWarlordMode }) {
  const { turn, me } = gameState;
  const [magicianMode, setMagicianMode] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [labMode, setLabMode] = useState(false);

  if (!turn) return null;

  if (!turn.isMyTurn) {
    return (
      <div className="action-panel waiting">
        <p>
          Waiting for <strong>{turn.roleName}</strong> to act...
        </p>
      </div>
    );
  }

  const handleTakeGold = () => emit(EVENTS.TAKE_GOLD);
  const handleDrawCards = () => emit(EVENTS.DRAW_CARDS);
  const handleEndTurn = () => emit(EVENTS.END_TURN);

  const handleRoleAbility = (params) => {
    emit(EVENTS.USE_ABILITY, params);
  };

  // Role target selector for Assassin / Thief
  const RoleTargetAbility = ({ label }) => (
    <div className="ability-section">
      <strong>{label}</strong>
      <div className="role-targets">
        {turn.abilityTargets?.map(roleId => {
          const role = ROLE_LIST.find(r => r.id === roleId);
          return (
            <button
              key={roleId}
              className="btn-ability"
              onClick={() => handleRoleAbility({ targetRoleId: roleId })}
            >
              {role?.name} ({roleId})
            </button>
          );
        })}
      </div>
    </div>
  );

  // Magician ability UI
  const MagicianAbility = () => {
    if (magicianMode === 'swap') {
      const opponentId = gameState.opponentId;
      return (
        <div className="ability-section">
          <button
            className="btn-ability"
            onClick={() => {
              handleRoleAbility({ action: 'swap', targetPlayerId: opponentId });
              setMagicianMode(null);
            }}
          >
            Swap hands with opponent
          </button>
          <button className="btn-secondary" onClick={() => setMagicianMode(null)}>Cancel</button>
        </div>
      );
    }

    if (magicianMode === 'discard') {
      return (
        <div className="ability-section">
          <p>Select cards to discard (then draw same number):</p>
          <div className="hand-select">
            {me.hand.map(card => (
              <label key={card.id} className="card-check">
                <input
                  type="checkbox"
                  checked={selectedCards.includes(card.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCards([...selectedCards, card.id]);
                    else setSelectedCards(selectedCards.filter(id => id !== card.id));
                  }}
                />
                {card.name} ({card.cost})
              </label>
            ))}
          </div>
          <button
            className="btn-ability"
            disabled={selectedCards.length === 0}
            onClick={() => {
              handleRoleAbility({ action: 'discard', cardIds: selectedCards });
              setMagicianMode(null);
              setSelectedCards([]);
            }}
          >
            Discard {selectedCards.length} card(s)
          </button>
          <button className="btn-secondary" onClick={() => { setMagicianMode(null); setSelectedCards([]); }}>Cancel</button>
        </div>
      );
    }

    return (
      <div className="ability-section">
        <strong>Magician Ability:</strong>
        <button className="btn-ability" onClick={() => setMagicianMode('swap')}>Swap Hand with Opponent</button>
        <button className="btn-ability" onClick={() => setMagicianMode('discard')}>Discard & Redraw Cards</button>
      </div>
    );
  };

  // Warlord destroy district ability
  const WarlordAbility = () => (
    <div className="ability-section">
      <strong>Warlord:</strong>
      {turn.abilityTargets?.length > 0 ? (
        <button className="btn-ability" onClick={() => setWarlordMode(true)}>
          Destroy a District
        </button>
      ) : (
        <span className="muted">No valid targets</span>
      )}
    </div>
  );

  // Card drawn — must pick one to keep
  if (turn.drawnCards) {
    return (
      <div className="action-panel">
        <h3>Choose a card to keep:</h3>
        <div className="drawn-cards">
          {turn.drawnCards.map(card => (
            <button
              key={card.id}
              className="district-card-btn"
              onClick={() => emit(EVENTS.KEEP_CARD, { cardId: card.id })}
            >
              <strong>{card.name}</strong>
              <span> — {card.cost} gold ({card.color})</span>
              {card.desc && <span className="drawn-card-desc">{card.desc}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <div className="turn-header">
        <h3>Your Turn — <em>{turn.roleName}</em></h3>
        <span className="builds-left">Builds left: {turn.buildsRemaining}</span>
      </div>

      {/* Income */}
      {!turn.hasTakenIncome && (
        <div className="income-section">
          <strong>Take Income:</strong>
          <button className="btn-primary" onClick={handleTakeGold}>Take 2 Gold</button>
          <button className="btn-secondary" onClick={handleDrawCards}>Draw 2 Cards (keep 1)</button>
        </div>
      )}

      {/* Abilities */}
      {!turn.hasUsedAbility && turn.abilityType && (
        <div className="ability-row">
          {turn.abilityType === 'role' && turn.roleName === 'Assassin' && (
            <RoleTargetAbility label="Assassinate a role:" />
          )}
          {turn.abilityType === 'role' && turn.roleName === 'Thief' && (
            <RoleTargetAbility label="Steal from a role:" />
          )}
          {turn.abilityType === 'magician_choice' && <MagicianAbility />}
          {turn.abilityType === 'district' && <WarlordAbility />}
        </div>
      )}

      {/* Color bonus collection */}
      {turn.bonusColor && turn.hasCollectedBonus === false && (
        <div className="ability-section">
          <strong>Collect {turn.bonusColor.charAt(0).toUpperCase() + turn.bonusColor.slice(1)} Bonus:</strong>
          <button
            className="btn-ability"
            onClick={() => emit(EVENTS.COLLECT_BONUS)}
          >
            +1 gold per {turn.bonusColor} district
          </button>
        </div>
      )}

      {/* Building abilities: Laboratory & Smithy */}
      {(turn.canUseLaboratory || turn.canUseSmithy) && (
        <div className="ability-section">
          <strong>Building Abilities:</strong>
          {turn.canUseSmithy && (
            <button className="btn-ability" onClick={() => emit(EVENTS.USE_SMITHY)}>
              Smithy — Pay 2 gold, draw 3 cards
            </button>
          )}
          {turn.canUseLaboratory && !labMode && (
            <button className="btn-ability" onClick={() => setLabMode(true)}>
              Laboratory — Discard a card for 2 gold
            </button>
          )}
          {turn.canUseLaboratory && labMode && (
            <div>
              <p>Choose a card to discard for 2 gold:</p>
              <div className="drawn-cards">
                {me.hand.map(card => (
                  <button
                    key={card.id}
                    className="district-card-btn"
                    onClick={() => { emit(EVENTS.USE_LABORATORY, { cardId: card.id }); setLabMode(false); }}
                  >
                    <strong>{card.name}</strong>
                    <span> — {card.cost} gold ({card.color})</span>
                  </button>
                ))}
              </div>
              <button className="btn-secondary" onClick={() => setLabMode(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Build district note */}
      {turn.hasTakenIncome && turn.buildsRemaining > 0 && (
        <div className="build-hint">
          Click a card in your hand to build it in your city.
        </div>
      )}

      {/* End turn */}
      {turn.hasTakenIncome && (
        <button
          className="btn-end-turn"
          onClick={handleEndTurn}
          disabled={!!turn.drawnCards}
        >
          End Turn
        </button>
      )}
    </div>
  );
}
