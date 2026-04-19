import { useState } from 'react';
import { DISTRICT_COLORS } from '../../../shared/constants.js';

const COLOR_STYLE = {
  noble: { background: '#f0c040', color: '#333' },
  religious: { background: '#4488cc', color: '#fff' },
  trade: { background: '#44aa44', color: '#fff' },
  military: { background: '#cc4444', color: '#fff' },
  unique: { background: '#aa66cc', color: '#fff' },
};

function DistrictCard({ district, onClick, disabled, highlight, alreadyBuilt }) {
  const [showDesc, setShowDesc] = useState(false);
  const style = COLOR_STYLE[district.color] || {};
  const hasDesc = district.color === 'unique' && district.desc;

  const handleClick = (e) => {
    if (hasDesc && !onClick) {
      e.stopPropagation();
      setShowDesc(prev => !prev);
      return;
    }
    if (onClick) onClick();
  };

  return (
    <div className="district-card-wrapper">
      <button
        className={`district-card ${highlight ? 'highlight' : ''} ${hasDesc ? 'has-desc' : ''} ${alreadyBuilt ? 'already-built' : ''}`}
        style={style}
        onClick={handleClick}
        disabled={disabled && !hasDesc}
        title={alreadyBuilt ? `${district.name} — Already built in your city` : `${district.name} — Cost: ${district.cost}`}
      >
        <span className="district-cost">{district.cost}</span>
        <span className="district-name">{district.name}</span>
        <span className="district-color">{DISTRICT_COLORS[district.color]?.label}</span>
        {hasDesc && <span className="district-info-icon">?</span>}
        {alreadyBuilt && <span className="district-dupe-badge">Built</span>}
      </button>
      {hasDesc && showDesc && (
        <div className="district-tooltip" onClick={() => setShowDesc(false)}>
          <strong>{district.name}</strong>
          <p>{district.desc}</p>
        </div>
      )}
    </div>
  );
}

export function PlayerBoard({ player, isMe, label, hasCrown, onBuildDistrict, canBuild, onWarlordTarget, warlordTargets }) {
  return (
    <div className={`player-board ${isMe ? 'my-board' : 'opponent-board'}`}>
      <div className="board-header">
        <span className="board-label">
          {label}
          {hasCrown && <span className="crown-icon" title="Holds the crown token">👑</span>}
        </span>
        <span className="gold-counter">💰 {player.gold}</span>
        {!isMe && <span className="hand-count">🃏 {player.handCount} in hand</span>}
      </div>

      {/* City */}
      <div className="city">
        <div className="city-label">City ({player.city.length}/8)</div>
        <div className="district-grid">
          {player.city.map(district => {
            const isWarlordTarget = warlordTargets?.some(
              t => t.districtId === district.id && t.playerId === (isMe ? undefined : district.playerId)
            );
            return (
              <DistrictCard
                key={district.id}
                district={district}
                onClick={
                  !isMe && onWarlordTarget && warlordTargets?.find(t => t.districtId === district.id)
                    ? () => onWarlordTarget(district.id)
                    : undefined
                }
                disabled={!(!isMe && onWarlordTarget && warlordTargets?.find(t => t.districtId === district.id))}
                highlight={!isMe && warlordTargets?.some(t => t.districtId === district.id)}
              />
            );
          })}
          {player.city.length === 0 && (
            <span className="empty-city">No districts built yet</span>
          )}
        </div>
      </div>

      {/* Hand (only shown for me) */}
      {isMe && player.hand && (
        <div className="hand">
          <div className="hand-label">Hand ({player.hand.length})</div>
          <div className="district-grid">
            {player.hand.map(card => {
              const alreadyBuilt = player.city.some(d => d.name === card.name);
              const affordable = canBuild && !alreadyBuilt && card.cost <= player.gold;
              return (
                <DistrictCard
                  key={card.id}
                  district={card}
                  onClick={affordable ? () => onBuildDistrict(card.id) : undefined}
                  disabled={!affordable}
                  highlight={affordable}
                  alreadyBuilt={alreadyBuilt && canBuild}
                />
              );
            })}
            {player.hand.length === 0 && (
              <span className="empty-hand">No cards in hand</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
