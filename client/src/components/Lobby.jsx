import { useState } from 'react';
import { EVENTS, ROLE_CONFIGS } from '../../../shared/constants.js';

const CONFIG_ORDER = ['classic', 'brave', 'scholarly', 'vicious_nobles'];

export function Lobby({ emit, gameCode, error }) {
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState('home'); // 'home' | 'setup'
  const [configKey, setConfigKey] = useState('classic');
  // Rank-9 inclusion is tracked per-config so toggling presets preserves
  // each scenario's default. Populated lazily from ROLE_CONFIGS defaults.
  const [rank9ByConfig, setRank9ByConfig] = useState(() =>
    Object.fromEntries(
      CONFIG_ORDER.map(k => [k, ROLE_CONFIGS[k]?.rank9?.defaultInclude ?? false])
    )
  );

  const selectedConfig = ROLE_CONFIGS[configKey];
  const includeRank9 = rank9ByConfig[configKey] ?? false;

  const handleCreate = () => {
    setView('setup');
  };

  const handleConfirmSetup = () => {
    emit(EVENTS.CREATE_GAME, { configKey, includeRank9 });
  };

  const handleBack = () => {
    setView('home');
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

      {!gameCode && view === 'home' && (
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
      )}

      {!gameCode && view === 'setup' && (
        <div className="lobby-actions setup-screen">
          <h2>Game Setup</h2>
          <p className="setup-intro">Choose a role configuration for this game.</p>

          <div className="setup-configs" role="radiogroup">
            {CONFIG_ORDER.map(key => {
              const cfg = ROLE_CONFIGS[key];
              if (!cfg) return null;
              const selected = configKey === key;
              return (
                <label
                  key={key}
                  className={`setup-toggle ${selected ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="role-config"
                    value={key}
                    checked={selected}
                    onChange={() => setConfigKey(key)}
                  />
                  <span className="setup-toggle-body">
                    <span className="setup-toggle-title">{cfg.label}</span>
                    <span className="setup-toggle-desc">{cfg.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {selectedConfig?.rank9 && (
            <label className={`setup-toggle rank9-toggle ${includeRank9 ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={includeRank9}
                onChange={(e) =>
                  setRank9ByConfig(prev => ({ ...prev, [configKey]: e.target.checked }))
                }
              />
              <span className="setup-toggle-body">
                <span className="setup-toggle-title">{selectedConfig.rank9.label}</span>
                <span className="setup-toggle-desc">{selectedConfig.rank9.description}</span>
              </span>
            </label>
          )}

          <div className="setup-actions">
            <button className="btn-secondary" onClick={handleBack}>Back</button>
            <button className="btn-primary" onClick={handleConfirmSetup}>Create Game</button>
          </div>
        </div>
      )}

      {gameCode && (
        <div className="waiting">
          <p>Game Code: <strong className="game-code">{gameCode}</strong></p>
          <p className="waiting-msg">Waiting for opponent to join...</p>
          <p className="hint">Share the code with your opponent!</p>
        </div>
      )}
    </div>
  );
}
