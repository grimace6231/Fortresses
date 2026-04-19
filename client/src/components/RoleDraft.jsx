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
  9: '+3 gold if the other player holds the crown token',
  10: 'Draw 7 cards and keep 1 (no income, no extra builds)',
  11: 'Take crown. +1 card per noble district. Build up to 2',
  12: '+1 card per religious district. Trade cards 1:1 to opponent for gold to build',
  13: '+1 gold per trade district. Trade district builds are free extras',
  14: 'Every non-TC build donates 1 gold to the tax chest; collect it on your turn',
};

export function RoleDraft({ gameState, emit }) {
  const { draft, me } = gameState;
  if (!draft) return null;

  const isMyTurn = draft.currentPicker === gameState.myId;
  const isPicking = draft.action === 'pick';
  const isDiscarding = draft.action === 'discard';

  const allRoleIds = draft.allRoleIds || ROLE_LIST.map(r => r.id);
  const availableIds = new Set(draft.availableIds || []);
  const myRoleIds = new Set(me.roles.map(r => r.id));
  const discardedIds = new Set((draft.discarded || []).map(r => r.id));

  const rankOf = (id) => ROLE_LIST.find(r => r.id === id)?.rank ?? id;

  // Roles shown in the main pool — everything except the player's own picks.
  // Greyed out if not available for picking (i.e. opponent-picked or discarded).
  const poolRoleIds = allRoleIds
    .filter(id => !myRoleIds.has(id))
    .sort((a, b) => rankOf(a) - rankOf(b));

  const handlePick = (roleId) => {
    if (!isMyTurn) return;
    if (!availableIds.has(roleId)) return;
    emit(EVENTS.DRAFT_PICK, { roleId });
  };

  const getRole = (id) => ROLE_LIST.find(r => r.id === id);

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

      <div className="available-roles">
        <h3>{isMyTurn ? (isPicking ? 'Pick a Role' : 'Discard a Role') : 'Role Pool'}</h3>
        <div className="role-list">
          {poolRoleIds.map(id => {
            const role = getRole(id);
            if (!role) return null;
            const isAvailable = availableIds.has(id);
            const isDiscarded = discardedIds.has(id);
            const selectable = isMyTurn && isAvailable;
            const classes = ['role-card'];
            if (selectable) classes.push('selectable');
            else classes.push('unavailable');
            if (isDiscarded) classes.push('discarded');
            if (isDiscarding && selectable) classes.push('discard-mode');

            return (
              <button
                key={id}
                className={classes.join(' ')}
                onClick={() => handlePick(id)}
                disabled={!selectable}
              >
                <span className="role-num">{role.rank ?? role.id}</span>
                <span className="role-name">{role.name}</span>
                <span className="role-desc">{ROLE_DESCRIPTIONS[role.id]}</span>
                {isDiscarded && <span className="role-tag">Discarded</span>}
                {!isAvailable && !isDiscarded && <span className="role-tag">Taken</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* My selected roles */}
      <div className="my-roles">
        <h3>Your Roles ({me.roles.length}/2)</h3>
        {me.roles.length > 0 ? (
          <div className="role-list">
            {[...me.roles]
              .sort((a, b) => (a.rank ?? a.id) - (b.rank ?? b.id))
              .map(role => (
                <div key={role.id} className="role-card selected">
                  <span className="role-num">{role.rank ?? role.id}</span>
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
