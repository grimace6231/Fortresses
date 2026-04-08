import { useState } from 'react';
import { EVENTS } from '../../../shared/constants.js';

export function Lobby({ emit, gameCode, error }) {
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    emit(EVENTS.CREATE_GAME);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length === 4) {
      emit(EVENTS.JOIN_GAME, { code: joinCode.trim() });
    }
  };

  return (
    <div className="lobby">
      <h1>Fortresses</h1>
      <p className="subtitle">A game of Citadels</p>

      {error && <div className="error">{error}</div>}

      {!gameCode ? (
        <div className="lobby-actions">
          <button className="btn-primary" onClick={handleCreate}>
            Create Game
          </button>

          <div className="divider">or</div>

          <form className="join-form" onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Game code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <button type="submit" className="btn-secondary">
              Join Game
            </button>
          </form>
        </div>
      ) : (
        <div className="waiting">
          <p>Game Code: <strong className="game-code">{gameCode}</strong></p>
          <p className="waiting-msg">Waiting for opponent to join...</p>
          <p className="hint">Share the code with your opponent!</p>
        </div>
      )}
    </div>
  );
}
