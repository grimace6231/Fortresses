import { EVENTS, PHASES } from '../../../shared/constants.js';

function broadcastState(io, lobby, code) {
  const game = lobby.games[code];
  if (!game) return;

  for (const playerId of Object.keys(game.players)) {
    const socketId = lobby.getSocketId(playerId);
    if (!socketId) continue; // player disconnected
    const state = game.getStateForPlayer(playerId);
    io.to(socketId).emit(EVENTS.GAME_STATE, state);
  }
}

export function registerHandlers(io, socket, lobby) {
  // Authenticate: validate returning player or create new identity
  const clientPlayerId = socket.handshake.auth.playerId;
  const clientToken = socket.handshake.auth.token;
  const authResult = lobby.authenticatePlayer(clientPlayerId, clientToken);

  let playerId;
  if (typeof authResult === 'string') {
    // Returning player with valid token
    playerId = authResult;
  } else {
    // New player — send them their credentials
    playerId = authResult.playerId;
    socket.emit('auth', { playerId: authResult.playerId, token: authResult.token });
  }

  lobby.registerSocket(socket.id, playerId);

  // Check for reconnection to an existing game
  const reconnect = lobby.tryReconnect(socket.id);
  if (reconnect) {
    socket.emit(EVENTS.GAME_RECONNECTED, { code: reconnect.code });
    broadcastState(io, lobby, reconnect.code);
  }

  // Helper to get playerId for game engine calls
  const pid = () => lobby.getPlayerId(socket.id);

  // Create a new game
  socket.on(EVENTS.CREATE_GAME, () => {
    const result = lobby.createGame(socket.id);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }
    socket.emit(EVENTS.GAME_CREATED, { code: result.code });
  });

  // Join an existing game
  socket.on(EVENTS.JOIN_GAME, (data) => {
    if (!data || typeof data.code !== 'string') {
      socket.emit(EVENTS.GAME_ERROR, { message: 'Invalid game code' });
      return;
    }
    const result = lobby.joinGame(socket.id, data.code.toUpperCase());
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    socket.emit(EVENTS.GAME_JOINED, { code: result.code });

    // If 2 players, auto-start
    const game = result.game;
    if (Object.keys(game.players).length === 2) {
      const startResult = lobby.startGame(socket.id);
      if (startResult.error) {
        socket.emit(EVENTS.GAME_ERROR, { message: startResult.error });
        return;
      }
      broadcastState(io, lobby, result.code);
    }
  });

  // Draft: pick a role
  socket.on(EVENTS.DRAFT_PICK, ({ roleId }) => {
    const game = lobby.getGame(socket.id);
    if (!game || game.phase !== PHASES.DRAFT) return;

    const result = game.draftPick(pid(), roleId);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: take gold
  socket.on(EVENTS.TAKE_GOLD, () => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.takeGold(pid());
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: draw cards (income choice)
  socket.on(EVENTS.DRAW_CARDS, () => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.drawCards(pid());
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: keep a card from drawn set
  socket.on(EVENTS.KEEP_CARD, ({ cardId }) => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.keepCard(pid(), cardId);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: build a district
  socket.on(EVENTS.BUILD_DISTRICT, ({ cardId }) => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.buildDistrict(pid(), cardId);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: use role ability
  socket.on(EVENTS.USE_ABILITY, (params) => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.useAbility(pid(), params);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Building ability: Laboratory
  socket.on(EVENTS.USE_LABORATORY, ({ cardId }) => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.useLaboratory(pid(), cardId);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Building ability: Smithy
  socket.on(EVENTS.USE_SMITHY, () => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.useSmithy(pid());
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Turn: end turn
  socket.on(EVENTS.END_TURN, () => {
    const game = lobby.getGame(socket.id);
    if (!game) return;

    const result = game.endTurn(pid());
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Disconnect — keep game alive
  socket.on('disconnect', () => {
    lobby.removeSocket(socket.id);
  });
}
