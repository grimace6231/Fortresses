import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { EVENTS } from '../../../shared/constants.js';

function getAuth() {
  return {
    playerId: localStorage.getItem('fortresses-player-id') || null,
    token: localStorage.getItem('fortresses-token') || null,
  };
}

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [gameCode, setGameCode] = useState(null);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const auth = getAuth();
    const socket = io(serverUrl, { auth });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Server issues credentials on first connect
    socket.on('auth', ({ playerId, token }) => {
      localStorage.setItem('fortresses-player-id', playerId);
      localStorage.setItem('fortresses-token', token);
    });

    socket.on(EVENTS.GAME_CREATED, ({ code }) => {
      setGameCode(code);
    });

    socket.on(EVENTS.GAME_JOINED, ({ code }) => {
      setGameCode(code);
    });

    // Reconnected to an existing game
    socket.on(EVENTS.GAME_RECONNECTED, ({ code }) => {
      setGameCode(code);
    });

    socket.on(EVENTS.GAME_STATE, (state) => {
      setGameState(state);
      setError(null);
    });

    socket.on(EVENTS.GAME_ERROR, ({ message }) => {
      setError(message);
    });

    socket.on(EVENTS.GAME_QUIT, () => {
      setGameState(null);
      setGameCode(null);
    });

    return () => socket.disconnect();
  }, []);

  const emit = (event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data);
  };

  return { connected, gameState, error, gameCode, emit, setError };
}
