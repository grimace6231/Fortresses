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
  const { turn, me, opponent, taxGold } = gameState;
  const [magicianMode, setMagicianMode] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [labMode, setLabMode] = useState(false);
  const [cardinalBuild, setCardinalBuild] = useState(null); // { cardId, payCardIds: [] }

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
            +1 {turn.bonusResource === 'card' ? 'card' : 'gold'} per {turn.bonusColor} district
          </button>
        </div>
      )}

      {/* Trader: free trade-district builds */}
      {turn.tradeFreeBuilds && (
        <div className="build-hint">
          Trade districts don't consume your build slot — build any number of them.
        </div>
      )}

      {/* Cardinal: build-with-cards flow */}
      {turn.canBuildWithCards && !cardinalBuild && turn.hasTakenIncome && turn.buildsRemaining > 0 && (
        <div className="ability-section">
          <strong>Cardinal trade-build:</strong>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Pick a district you can't afford, then trade cards to the opponent at 1 card = 1 gold.
          </p>
          <div className="drawn-cards">
            {me.hand
              .filter(card => card.cost > me.gold && !me.city.some(d => d.name === card.name))
              .map(card => {
                const shortfall = card.cost - me.gold;
                const canPay = me.hand.length - 1 >= shortfall && opponent.gold >= shortfall;
                return (
                  <button
                    key={card.id}
                    className="district-card-btn"
                    disabled={!canPay}
                    onClick={() => setCardinalBuild({ cardId: card.id, payCardIds: [] })}
                  >
                    <strong>{card.name}</strong>
                    <span> — cost {card.cost}, short {shortfall}</span>
                    {!canPay && <span className="drawn-card-desc">Not enough cards/opponent gold</span>}
                  </button>
                );
              })}
            {me.hand.filter(card => card.cost > me.gold && !me.city.some(d => d.name === card.name)).length === 0 && (
              <span className="muted">No unaffordable districts in hand.</span>
            )}
          </div>
        </div>
      )}

      {turn.canBuildWithCards && cardinalBuild && (() => {
        const targetCard = me.hand.find(c => c.id === cardinalBuild.cardId);
        if (!targetCard) return null;
        const shortfall = Math.max(0, targetCard.cost - me.gold);
        const picked = cardinalBuild.payCardIds;
        const done = picked.length === shortfall;
        return (
          <div className="ability-section">
            <strong>Trade-build: {targetCard.name}</strong>
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              Give the opponent {shortfall} card(s); they give you {shortfall} gold toward this build. Selected {picked.length}/{shortfall}.
            </p>
            <div className="hand-select">
              {me.hand.filter(c => c.id !== cardinalBuild.cardId).map(card => (
                <label key={card.id} className="card-check">
                  <input
                    type="checkbox"
                    checked={picked.includes(card.id)}
                    disabled={!picked.includes(card.id) && picked.length >= shortfall}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...picked, card.id]
                        : picked.filter(id => id !== card.id);
                      setCardinalBuild({ ...cardinalBuild, payCardIds: next });
                    }}
                  />
                  {card.name} ({card.cost})
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-ability"
                disabled={!done}
                onClick={() => {
                  emit(EVENTS.BUILD_WITH_CARDS, {
                    cardId: cardinalBuild.cardId,
                    cardIds: cardinalBuild.payCardIds,
                    goldPaid: me.gold,
                  });
                  setCardinalBuild(null);
                }}
              >
                Build for {me.gold} gold + {picked.length} card(s)
              </button>
              <button className="btn-secondary" onClick={() => setCardinalBuild(null)}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* Tax Collector chest readout */}
      {taxGold != null && taxGold > 0 && turn.roleId !== 14 && (
        <div className="build-hint">
          Tax chest holds {taxGold} gold. Each build donates 1 gold until the Tax Collector collects.
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
