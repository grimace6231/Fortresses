import { useSocket } from './hooks/useSocket.js';
import { Lobby } from './components/Lobby.jsx';
import { Game } from './components/Game.jsx';
import { PHASES } from '../../shared/constants.js';
import './App.css';

export default function App() {
  const { connected, gameState, error, gameCode, emit, setError } = useSocket();

  const inGame = gameState && gameState.phase !== PHASES.WAITING;

  return (
    <div className="app">
      {!connected && (
        <div className="connecting">Connecting to server...</div>
      )}

      {connected && !inGame && (
        <Lobby emit={emit} gameCode={gameCode} error={error} />
      )}

      {connected && inGame && (
        <Game gameState={gameState} emit={emit} error={error} />
      )}
    </div>
  );
}
