import { GameEngine } from '../game/GameEngine.js';

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class LobbyManager {
  constructor() {
    this.games = {}; // { gameCode: GameEngine }
    this.playerGame = {}; // { playerId: gameCode }
    this.socketToPlayer = {}; // { socketId: playerId }
    this.playerToSocket = {}; // { playerId: socketId }
  }

  // Map a socket to a persistent player ID
  registerSocket(socketId, playerId) {
    // If this player already had a socket, clean up old mapping
    const oldSocket = this.playerToSocket[playerId];
    if (oldSocket) {
      delete this.socketToPlayer[oldSocket];
    }
    this.socketToPlayer[socketId] = playerId;
    this.playerToSocket[playerId] = socketId;
  }

  getPlayerId(socketId) {
    return this.socketToPlayer[socketId] || null;
  }

  getSocketId(playerId) {
    return this.playerToSocket[playerId] || null;
  }

  createGame(socketId) {
    const playerId = this.getPlayerId(socketId);
    let code;
    do { code = generateCode(); } while (this.games[code]);

    const game = new GameEngine(code);
    game.addPlayer(playerId);
    this.games[code] = game;
    this.playerGame[playerId] = code;

    return { code, game };
  }

  joinGame(socketId, code) {
    const playerId = this.getPlayerId(socketId);
    const game = this.games[code];
    if (!game) return { error: 'Game not found' };
    if (Object.keys(game.players).length >= 2) return { error: 'Game is full' };

    if (!game.addPlayer(playerId)) return { error: 'Could not join game' };
    this.playerGame[playerId] = code;

    return { code, game };
  }

  startGame(socketId) {
    const playerId = this.getPlayerId(socketId);
    const code = this.playerGame[playerId];
    if (!code) return { error: 'Not in a game' };

    const game = this.games[code];
    if (Object.keys(game.players).length < 2) return { error: 'Need 2 players' };

    const ok = game.start();
    if (!ok) return { error: 'Could not start game' };

    return { code, game };
  }

  // Check if a player has an active game to reconnect to
  tryReconnect(socketId) {
    const playerId = this.getPlayerId(socketId);
    const code = this.playerGame[playerId];
    if (!code) return null;

    const game = this.games[code];
    if (!game) {
      delete this.playerGame[playerId];
      return null;
    }

    // Check this player is actually in this game
    if (!game.players[playerId]) {
      delete this.playerGame[playerId];
      return null;
    }

    game.players[playerId].connected = true;
    return { code, game };
  }

  getGame(socketId) {
    const playerId = this.getPlayerId(socketId);
    const code = this.playerGame[playerId];
    return code ? this.games[code] : null;
  }

  getCode(socketId) {
    const playerId = this.getPlayerId(socketId);
    return this.playerGame[playerId] || null;
  }

  removeSocket(socketId) {
    const playerId = this.getPlayerId(socketId);
    if (!playerId) return;

    // Mark player as disconnected but keep game alive
    const code = this.playerGame[playerId];
    if (code) {
      const game = this.games[code];
      if (game && game.players[playerId]) {
        game.players[playerId].connected = false;
      }
    }

    delete this.socketToPlayer[socketId];
    delete this.playerToSocket[playerId];
  }
}
