import { useState, useEffect, useRef } from 'react';
import { PHASES, EVENTS } from '../../../shared/constants.js';
import { RoleDraft } from './RoleDraft.jsx';
import { PlayerBoard } from './PlayerBoard.jsx';
import { ActionPanel } from './ActionPanel.jsx';
import { GameLog } from './GameLog.jsx';

export function Game({ gameState, emit, error }) {
  const [logs, setLogs] = useState([]);
  const [warlordMode, setWarlordMode] = useState(false);
  const [eventAnimation, setEventAnimation] = useState(null);
  const [quitConfirm, setQuitConfirm] = useState(false);
  const prevStateRef = useRef(null);

  // Build game log from server events + state changes
  useEffect(() => {
    if (!gameState) return;
    const prev = prevStateRef.current;

    const newLogs = [];

    // Detect phase changes
    if (!prev || prev.phase !== gameState.phase) {
      if (gameState.phase === PHASES.DRAFT) {
        newLogs.push({ message: `── Round ${gameState.round} ──`, type: 'round' });
      }
      if (gameState.phase === PHASES.TURNS) {
        newLogs.push({ message: 'Roles revealed! Turns begin.', type: 'info' });
      }
    }

    // Detect turn change
    if (gameState.turn && (!prev || prev.turn?.roleId !== gameState.turn.roleId || prev.turn?.playerId !== gameState.turn.playerId)) {
      const isMe = gameState.turn.playerId === gameState.myId;
      newLogs.push({
        message: `${isMe ? 'You are' : 'Opponent is'} acting as ${gameState.turn.roleName}`,
        type: isMe ? 'my-turn' : 'their-turn',
      });
    }

    // Append server-side events (assassinations, thefts, ability use, builds, etc.)
    if (gameState.newEvents && gameState.newEvents.length > 0) {
      for (const msg of gameState.newEvents) {
        newLogs.push({ message: msg, type: 'event' });
      }
    }

    if (newLogs.length > 0) {
      setLogs(l => [...l, ...newLogs]);
    }

    // Detect assassination/theft for animations
    if (gameState.newEvents && gameState.newEvents.length > 0) {
      for (const msg of gameState.newEvents) {
        if (msg.includes('was assassinated')) {
          setEventAnimation({ type: 'assassin', message: msg });
        } else if (msg.includes('steals') && msg.includes('gold from')) {
          setEventAnimation({ type: 'thief', message: msg });
        }
      }
    }

    prevStateRef.current = gameState;
  }, [gameState]);

  // Auto-dismiss animation
  useEffect(() => {
    if (eventAnimation) {
      const timer = setTimeout(() => setEventAnimation(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [eventAnimation]);

  if (!gameState) return null;

  const { phase, me, opponent, turn } = gameState;

  // Warlord targets are indexed by district id for the opponent
  const warlordTargets = warlordMode && turn?.abilityTargets
    ? turn.abilityTargets
    : null;

  const handleWarlordTarget = (districtId) => {
    const target = warlordTargets?.find(t => t.districtId === districtId);
    if (!target) return;
    emit(EVENTS.USE_ABILITY, {
      targetPlayerId: gameState.opponentId,
      targetDistrictId: districtId,
    });
    setWarlordMode(false);
  };

  const canBuild = (
    phase === PHASES.TURNS &&
    turn?.isMyTurn &&
    turn?.hasTakenIncome &&
    !turn?.drawnCards &&
    turn?.buildsRemaining > 0
  );

  const handleBuildDistrict = (cardId) => {
    emit(EVENTS.BUILD_DISTRICT, { cardId });
  };

  return (
    <div className="game-layout">
      {eventAnimation && (
        <div className={`event-overlay ${eventAnimation.type}`} key={Date.now()}>
          <div className="event-overlay-content">
            <span className="event-icon">
              {eventAnimation.type === 'assassin' ? '\u{1F5E1}' : '\u{1F4B0}'}
            </span>
            <span className="event-message">{eventAnimation.message}</span>
          </div>
        </div>
      )}
      <div className="game-main">
        {/* Opponent */}
        <PlayerBoard
          player={opponent}
          isMe={false}
          label="Opponent"
          hasCrown={gameState.crownHolder === gameState.opponentId}
          onWarlordTarget={warlordMode ? handleWarlordTarget : null}
          warlordTargets={warlordMode ? warlordTargets : null}
        />

        {/* Center panel */}
        <div className="center-panel">
          {phase === PHASES.DRAFT && (
            <RoleDraft gameState={gameState} emit={emit} />
          )}
          {phase === PHASES.TURNS && (
            <ActionPanel
              gameState={gameState}
              emit={emit}
              setWarlordMode={setWarlordMode}
              onWarlordTarget={handleWarlordTarget}
            />
          )}
          {phase === PHASES.GAME_OVER && (
            <div className="game-over">
              <h2>Game Over!</h2>
              <p>{gameState.winner === gameState.myId ? '🏆 You win!' : '💀 Opponent wins!'}</p>
              <div className="scores">
                <div>Your score: <strong>{gameState.scores?.[gameState.myId]}</strong></div>
                <div>Opponent score: <strong>{gameState.scores?.[gameState.opponentId]}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* You */}
        <PlayerBoard
          player={me}
          isMe={true}
          label="You"
          hasCrown={gameState.crownHolder === gameState.myId}
          onBuildDistrict={handleBuildDistrict}
          canBuild={canBuild}
        />
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="game-info">
          <span>Round {gameState.round}</span>
          <span>Deck: {gameState.deckCount}</span>
        </div>
        {error && <div className="error">{error}</div>}
        <GameLog logs={logs} />
        <div className="game-code-display">
          <span className="game-code-label">Game Code</span>
          <span className="game-code-value">{gameState.gameId}</span>
        </div>
        <button
          className="btn-quit"
          onClick={() => setQuitConfirm(true)}
        >
          Quit Game
        </button>
      </div>

      {quitConfirm && (
        <div className="modal-overlay" onClick={() => setQuitConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Quit Game?</h3>
            <p>This will end the game for both players. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setQuitConfirm(false)}>Cancel</button>
              <button
                className="btn-quit-confirm"
                onClick={() => { setQuitConfirm(false); emit(EVENTS.QUIT_GAME); }}
              >
                Quit Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
