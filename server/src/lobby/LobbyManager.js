import { GameEngine } from '../game/GameEngine.js';

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class LobbyManager {
  constructor() {
    this.games = {}; // { gameCode: GameEngine }
    this.playerGame = {}; // { socketId: gameCode }
  }

  createGame(socketId) {
    let code;
    do { code = generateCode(); } while (this.games[code]);

    const game = new GameEngine(code);
    game.addPlayer(socketId);
    this.games[code] = game;
    this.playerGame[socketId] = code;

    return { code, game };
  }

  joinGame(socketId, code) {
    const game = this.games[code];
    if (!game) return { error: 'Game not found' };
    if (Object.keys(game.players).length >= 2) return { error: 'Game is full' };

    if (!game.addPlayer(socketId)) return { error: 'Could not join game' };
    this.playerGame[socketId] = code;

    return { code, game };
  }

  startGame(socketId) {
    const code = this.playerGame[socketId];
    if (!code) return { error: 'Not in a game' };

    const game = this.games[code];
    if (Object.keys(game.players).length < 2) return { error: 'Need 2 players' };

    const ok = game.start();
    if (!ok) return { error: 'Could not start game' };

    return { code, game };
  }

  getGame(socketId) {
    const code = this.playerGame[socketId];
    return code ? this.games[code] : null;
  }

  getCode(socketId) {
    return this.playerGame[socketId] || null;
  }

  removePlayer(socketId) {
    const code = this.playerGame[socketId];
    if (!code) return;

    const game = this.games[code];
    if (game && game.players[socketId]) {
      game.players[socketId].connected = false;
    }

    delete this.playerGame[socketId];
  }
}
