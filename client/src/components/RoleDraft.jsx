import { EVENTS, ROLE_LIST, DISTRICT_COLORS } from '../../../shared/constants.js';

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
  const pickedRoleIds = new Set(me.roles.map(r => r.id));

  const handlePick = (roleId) => {
    emit(EVENTS.DRAFT_PICK, { roleId });
  };

  return (
    <div className="draft-phase">
      <h2>Role Selection</h2>

      <div className="draft-status">
        {isMyTurn
          ? <span className="your-turn">Your turn to pick a role</span>
          : <span className="waiting-turn">Opponent is choosing...</span>
        }
      </div>

      {/* Face-up discards */}
      {draft.faceUp && draft.faceUp.length > 0 && (
        <div className="discarded-roles">
          <h3>Removed (visible)</h3>
          <div className="role-list">
            {draft.faceUp.map(role => (
              <div key={role.id} className="role-card discarded">
                <span className="role-num">{role.id}</span>
                <span className="role-name">{role.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available roles (only shown on your pick) */}
      {isMyTurn && draft.available && (
        <div className="available-roles">
          <h3>Choose a Role</h3>
          <div className="role-list">
            {draft.available.map(role => (
              <button
                key={role.id}
                className="role-card selectable"
                onClick={() => handlePick(role.id)}
                disabled={pickedRoleIds.has(role.id)}
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
      {me.roles.length > 0 && (
        <div className="my-roles">
          <h3>Your Roles This Round</h3>
          <div className="role-list">
            {me.roles.map(role => (
              <div key={role.id} className="role-card selected">
                <span className="role-num">{role.id}</span>
                <span className="role-name">{role.name}</span>
                <span className="role-desc">{ROLE_DESCRIPTIONS[role.id]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
