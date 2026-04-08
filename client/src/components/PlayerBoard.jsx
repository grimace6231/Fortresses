import { DISTRICT_COLORS } from '../../../shared/constants.js';

const COLOR_STYLE = {
  noble: { background: '#f0c040', color: '#333' },
  religious: { background: '#4488cc', color: '#fff' },
  trade: { background: '#44aa44', color: '#fff' },
  military: { background: '#cc4444', color: '#fff' },
  unique: { background: '#aa66cc', color: '#fff' },
};

function DistrictCard({ district, onClick, disabled, highlight }) {
  const style = COLOR_STYLE[district.color] || {};
  return (
    <button
      className={`district-card ${highlight ? 'highlight' : ''}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      title={`${district.name} — Cost: ${district.cost}`}
    >
      <span className="district-cost">{district.cost}</span>
      <span className="district-name">{district.name}</span>
      <span className="district-color">{DISTRICT_COLORS[district.color]?.label}</span>
    </button>
  );
}

export function PlayerBoard({ player, isMe, label, onBuildDistrict, canBuild, onWarlordTarget, warlordTargets }) {
  return (
    <div className={`player-board ${isMe ? 'my-board' : 'opponent-board'}`}>
      <div className="board-header">
        <span className="board-label">{label}</span>
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
              const affordable = canBuild && card.cost <= player.gold;
              return (
                <DistrictCard
                  key={card.id}
                  district={card}
                  onClick={affordable ? () => onBuildDistrict(card.id) : undefined}
                  disabled={!affordable}
                  highlight={affordable}
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
