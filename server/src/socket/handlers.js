import { EVENTS, PHASES } from '../../../shared/constants.js';

function broadcastState(io, lobby, code) {
  const game = lobby.games[code];
  if (!game) return;

  for (const playerId of Object.keys(game.players)) {
    const state = game.getStateForPlayer(playerId);
    io.to(playerId).emit(EVENTS.GAME_STATE, state);
  }
}

export function registerHandlers(io, socket, lobby) {
  // Create a new game
  socket.on(EVENTS.CREATE_GAME, () => {
    const result = lobby.createGame(socket.id);
    socket.emit(EVENTS.GAME_CREATED, { code: result.code });
  });

  // Join an existing game
  socket.on(EVENTS.JOIN_GAME, ({ code }) => {
    const result = lobby.joinGame(socket.id, code.toUpperCase());
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

    const result = game.draftPick(socket.id, roleId);
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

    const result = game.takeGold(socket.id);
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

    const result = game.drawCards(socket.id);
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

    const result = game.keepCard(socket.id, cardId);
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

    const result = game.buildDistrict(socket.id, cardId);
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

    const result = game.useAbility(socket.id, params);
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

    const result = game.endTurn(socket.id);
    if (result.error) {
      socket.emit(EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastState(io, lobby, lobby.getCode(socket.id));
  });

  // Disconnect
  socket.on('disconnect', () => {
    lobby.removePlayer(socket.id);
  });
}
