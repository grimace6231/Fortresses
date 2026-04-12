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

export function RoleDraft({ gameState, emit }) {
  const { draft, me } = gameState;
  if (!draft) return null;

  const isMyTurn = draft.currentPicker === gameState.myId;
  const isPicking = draft.action === 'pick';
  const isDiscarding = draft.action === 'discard';

  const handlePick = (roleId) => {
    emit(EVENTS.DRAFT_PICK, { roleId });
  };

  return (
    <div className="draft-phase">
      <h2>Role Selection</h2>

      <div className="draft-status">
        {isMyTurn
          ? isPicking
            ? <span className="your-turn">Choose a role to keep</span>
            : <span className="your-turn discard-prompt">Choose a role to discard</span>
          : <span className="waiting-turn">Opponent is choosing...</span>
        }
      </div>

      {/* Available roles (only shown on your turn) */}
      {isMyTurn && draft.available && (
        <div className="available-roles">
          <h3>{isPicking ? 'Pick a Role' : 'Discard a Role'}</h3>
          <div className="role-list">
            {[...draft.available].sort((a, b) => a.id - b.id).map(role => (
              <button
                key={role.id}
                className={`role-card selectable ${isDiscarding ? 'discard-mode' : ''}`}
                onClick={() => handlePick(role.id)}
              >
                <span className="role-num">{role.id}</span>
                <span className="role-name">{role.name}</span>
                <span className="role-desc">{ROLE_DESCRIPTIONS[role.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My selected roles */}
      <div className="my-roles">
        <h3>Your Roles ({me.roles.length}/2)</h3>
        {me.roles.length > 0 ? (
          <div className="role-list">
            {[...me.roles].sort((a, b) => a.id - b.id).map(role => (
              <div key={role.id} className="role-card selected">
                <span className="role-num">{role.id}</span>
                <span className="role-name">{role.name}</span>
                <span className="role-desc">{ROLE_DESCRIPTIONS[role.id]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No roles selected yet</p>
        )}
      </div>
    </div>
  );
}
