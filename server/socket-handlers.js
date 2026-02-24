'use strict';

const { BLACK, WHITE, getValidMoves } = require('./game-engine');
const auth = require('./auth');
const lobby = require('./lobby');
const gameManager = require('./game-manager');
const db = require('./db');

function registerHandlers(io) {
  // Auth middleware: validate sessionId from handshake
  io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;
    if (!sessionId) {
      return next(new Error('Authentication required.'));
    }
    const session = auth.getSession(sessionId);
    if (!session) {
      return next(new Error('Invalid or expired session.'));
    }
    socket.userId = session.userId;
    socket.username = session.username;
    socket.elo = session.elo;
    socket.sessionId = sessionId;
    next();
  });

  io.on('connection', (socket) => {
    // Join lobby room and emit online count
    socket.join('lobby');
    io.to('lobby').emit('lobby:online-count', io.engine.clientsCount);

    // Check if user has an active game to reconnect to
    const existingGame = gameManager.getGameByUserId(socket.userId);
    if (existingGame && existingGame.status === 'active') {
      const game = gameManager.handleReconnect(existingGame.gameId, socket.userId, socket.id);
      if (game) {
        socket.join(`game:${game.gameId}`);
        const yourColor = game.players[BLACK].userId === socket.userId ? BLACK : WHITE;
        const opponentColor = yourColor === BLACK ? WHITE : BLACK;
        socket.emit('game:reconnect', {
          gameId: game.gameId,
          board: game.board,
          yourColor,
          opponent: {
            username: game.players[opponentColor].username,
          },
          currentPlayer: game.currentPlayer,
          moveHistory: game.moveHistory,
        });
      }
    }

    // --- Lobby Events ---

    socket.on('lobby:list', (callback) => {
      const rooms = lobby.listRooms();
      if (typeof callback === 'function') callback(rooms);
    });

    socket.on('lobby:create', (data, callback) => {
      const name = (data && data.name) || undefined;
      const room = lobby.createRoom(socket.userId, socket.username, socket.elo, name);
      socket.join(`room:${room.id}`);
      io.to('lobby').emit('lobby:room-created', room);
      if (typeof callback === 'function') callback(room);
    });

    socket.on('lobby:join', (data, callback) => {
      const roomId = data && data.roomId;
      if (!roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room ID required.' });
        return;
      }

      const room = lobby.joinRoom(roomId, socket.userId, socket.username, socket.elo);
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room not found or not joinable.' });
        return;
      }

      socket.join(`room:${room.id}`);
      io.to(`room:${room.id}`).emit('lobby:room-updated', room);
      io.to('lobby').emit('lobby:room-updated', room);
      if (typeof callback === 'function') callback({ ok: true, room });
    });

    socket.on('lobby:leave', (data, callback) => {
      const roomId = data && data.roomId;
      if (!roomId) {
        if (typeof callback === 'function') callback({ ok: false });
        return;
      }

      const { removed, room } = lobby.leaveRoom(roomId, socket.userId);
      socket.leave(`room:${roomId}`);

      if (removed) {
        io.to(`room:${roomId}`).emit('lobby:room-removed', { roomId });
        io.to('lobby').emit('lobby:room-removed', { roomId });
      } else if (room) {
        io.to(`room:${roomId}`).emit('lobby:room-updated', room);
        io.to('lobby').emit('lobby:room-updated', room);
      }

      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('lobby:start', (data, callback) => {
      const roomId = data && data.roomId;
      if (!roomId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room ID required.' });
        return;
      }

      const room = lobby.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room not found.' });
        return;
      }
      if (room.hostId !== socket.userId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Only the host can start the game.' });
        return;
      }
      if (room.status !== 'full') {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room is not full.' });
        return;
      }

      // Mark room as playing
      room.status = 'playing';

      // Determine colors: host is black, guest is white
      const blackSocketId = getSocketIdByUserId(io, room.hostId);
      const whiteSocketId = getSocketIdByUserId(io, room.guestId);

      const game = gameManager.createGame(
        { userId: room.hostId, username: room.hostUsername, elo: room.hostElo, socketId: blackSocketId },
        { userId: room.guestId, username: room.guestUsername, elo: room.guestElo, socketId: whiteSocketId }
      );

      // Join both sockets to the game room
      const blackSocket = io.sockets.sockets.get(blackSocketId);
      const whiteSocket = io.sockets.sockets.get(whiteSocketId);

      if (blackSocket) blackSocket.join(`game:${game.gameId}`);
      if (whiteSocket) whiteSocket.join(`game:${game.gameId}`);

      // Emit game:start to each player
      if (blackSocket) {
        blackSocket.emit('game:start', {
          gameId: game.gameId,
          board: game.board,
          yourColor: BLACK,
          opponent: { username: room.guestUsername, elo: room.guestElo },
          currentPlayer: game.currentPlayer,
        });
      }
      if (whiteSocket) {
        whiteSocket.emit('game:start', {
          gameId: game.gameId,
          board: game.board,
          yourColor: WHITE,
          opponent: { username: room.hostUsername, elo: room.hostElo },
          currentPlayer: game.currentPlayer,
        });
      }

      // Remove room from lobby
      lobby.removeRoom(roomId);
      io.to('lobby').emit('lobby:room-removed', { roomId });

      if (typeof callback === 'function') callback({ ok: true, gameId: game.gameId });
    });

    socket.on('lobby:quickmatch', (callback) => {
      lobby.addToQueue(socket.userId, socket.username, socket.elo, socket.id);

      const matched = lobby.findMatch(socket.userId);
      if (matched) {
        // Match found! Create a game
        // Randomly assign colors
        const isBlack = Math.random() < 0.5;
        const blackPlayer = isBlack
          ? { userId: socket.userId, username: socket.username, elo: socket.elo, socketId: socket.id }
          : { userId: matched.userId, username: matched.username, elo: matched.elo, socketId: matched.socketId };
        const whitePlayer = isBlack
          ? { userId: matched.userId, username: matched.username, elo: matched.elo, socketId: matched.socketId }
          : { userId: socket.userId, username: socket.username, elo: socket.elo, socketId: socket.id };

        const game = gameManager.createGame(blackPlayer, whitePlayer);

        // Join both sockets to the game room
        const blackSocket = io.sockets.sockets.get(blackPlayer.socketId);
        const whiteSocket = io.sockets.sockets.get(whitePlayer.socketId);

        if (blackSocket) blackSocket.join(`game:${game.gameId}`);
        if (whiteSocket) whiteSocket.join(`game:${game.gameId}`);

        // Emit game:start to each player
        if (blackSocket) {
          blackSocket.emit('game:start', {
            gameId: game.gameId,
            board: game.board,
            yourColor: BLACK,
            opponent: { username: whitePlayer.username, elo: whitePlayer.elo },
            currentPlayer: game.currentPlayer,
          });
        }
        if (whiteSocket) {
          whiteSocket.emit('game:start', {
            gameId: game.gameId,
            board: game.board,
            yourColor: WHITE,
            opponent: { username: blackPlayer.username, elo: blackPlayer.elo },
            currentPlayer: game.currentPlayer,
          });
        }
      }

      if (typeof callback === 'function') callback({ ok: true, queued: !matched });
    });

    socket.on('lobby:cancel-quickmatch', (callback) => {
      lobby.removeFromQueue(socket.userId);
      if (typeof callback === 'function') callback({ ok: true });
    });

    // --- Leaderboard ---

    socket.on('leaderboard:request', (data, callback) => {
      const limit = (data && data.limit) || 20;
      const leaderboard = db.getLeaderboard(limit);
      if (typeof callback === 'function') callback(leaderboard);
    });

    // --- Game Events ---

    socket.on('game:move', (data, callback) => {
      const { gameId, row, col } = data || {};
      if (gameId == null || row == null || col == null) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Missing move data.' });
        return;
      }

      const result = gameManager.makeMove(gameId, socket.userId, row, col);
      if (!result.ok) {
        if (typeof callback === 'function') callback(result);
        return;
      }

      // Emit to game room
      io.to(`game:${gameId}`).emit('game:move-made', {
        board: result.board,
        flips: result.flips,
        move: result.move,
        currentPlayer: result.currentPlayer,
        scores: result.scores,
      });

      // Handle pass
      if (result.passed) {
        io.to(`game:${gameId}`).emit('game:pass', {
          passedPlayer: result.passedPlayer,
          currentPlayer: result.currentPlayer,
        });
      }

      // Handle game over
      if (result.isGameOver) {
        io.to(`game:${gameId}`).emit('game:over', {
          result: result.result,
          scores: result.scores,
          eloChanges: result.eloChanges,
        });
      }

      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('game:resign', (data, callback) => {
      const gameId = data && data.gameId;
      if (!gameId) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Game ID required.' });
        return;
      }

      const result = gameManager.handleResign(gameId, socket.userId);
      if (!result.ok) {
        if (typeof callback === 'function') callback(result);
        return;
      }

      const game = gameManager.getGame(gameId);
      const scores = game ? require('./game-engine').countDiscs(game.board) : { black: 0, white: 0 };

      io.to(`game:${gameId}`).emit('game:over', {
        result: result.result,
        scores,
        eloChanges: result.eloChanges,
        reason: 'resign',
      });

      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('game:rematch-request', (data) => {
      const gameId = data && data.gameId;
      if (!gameId) return;

      const game = gameManager.getGame(gameId);
      if (!game) return;

      // Find opponent's socket
      const opponentColor = game.players[BLACK].userId === socket.userId ? WHITE : BLACK;
      const opponentSocketId = game.players[opponentColor].socketId;
      const opponentSocket = io.sockets.sockets.get(opponentSocketId);

      if (opponentSocket) {
        opponentSocket.emit('game:rematch-requested', {
          gameId,
          from: socket.username,
        });
      }
    });

    socket.on('game:rematch-accept', (data) => {
      const gameId = data && data.gameId;
      if (!gameId) return;

      const oldGame = gameManager.getGame(gameId);
      if (!oldGame) return;

      // Swap colors for the rematch
      const oldBlack = oldGame.players[BLACK];
      const oldWhite = oldGame.players[WHITE];

      const newGame = gameManager.createGame(
        { userId: oldWhite.userId, username: oldWhite.username, elo: db.getUserById(oldWhite.userId).elo, socketId: oldWhite.socketId },
        { userId: oldBlack.userId, username: oldBlack.username, elo: db.getUserById(oldBlack.userId).elo, socketId: oldBlack.socketId }
      );

      // Join both sockets to new game room
      const blackSocket = io.sockets.sockets.get(newGame.players[BLACK].socketId);
      const whiteSocket = io.sockets.sockets.get(newGame.players[WHITE].socketId);

      if (blackSocket) blackSocket.join(`game:${newGame.gameId}`);
      if (whiteSocket) whiteSocket.join(`game:${newGame.gameId}`);

      if (blackSocket) {
        blackSocket.emit('game:start', {
          gameId: newGame.gameId,
          board: newGame.board,
          yourColor: BLACK,
          opponent: { username: newGame.players[WHITE].username, elo: db.getUserById(newGame.players[WHITE].userId).elo },
          currentPlayer: newGame.currentPlayer,
        });
      }
      if (whiteSocket) {
        whiteSocket.emit('game:start', {
          gameId: newGame.gameId,
          board: newGame.board,
          yourColor: WHITE,
          opponent: { username: newGame.players[BLACK].username, elo: db.getUserById(newGame.players[BLACK].userId).elo },
          currentPlayer: newGame.currentPlayer,
        });
      }
    });

    socket.on('game:rematch-decline', (data) => {
      const gameId = data && data.gameId;
      if (!gameId) return;

      const game = gameManager.getGame(gameId);
      if (!game) return;

      // Notify the other player
      const opponentColor = game.players[BLACK].userId === socket.userId ? WHITE : BLACK;
      const opponentSocketId = game.players[opponentColor].socketId;
      const opponentSocket = io.sockets.sockets.get(opponentSocketId);

      if (opponentSocket) {
        opponentSocket.emit('game:rematch-declined', { gameId });
      }
    });

    // --- Disconnect ---

    socket.on('disconnect', () => {
      // Remove from lobby queue
      lobby.removeFromQueue(socket.userId);

      // Check all rooms for this user and clean up
      const rooms = lobby.listRooms();
      for (const room of rooms) {
        if (room.hostId === socket.userId || room.guestId === socket.userId) {
          lobby.leaveRoom(room.id, socket.userId);
          const updatedRoom = lobby.getRoom(room.id);
          if (!updatedRoom) {
            io.to('lobby').emit('lobby:room-removed', { roomId: room.id });
          } else {
            io.to('lobby').emit('lobby:room-updated', updatedRoom);
          }
        }
      }

      // Handle active game disconnect
      const game = gameManager.getGameByUserId(socket.userId);
      if (game && game.status === 'active') {
        gameManager.handleDisconnect(game.gameId, socket.userId);

        // Notify opponent
        const opponentColor = game.players[BLACK].userId === socket.userId ? WHITE : BLACK;
        const opponentSocketId = game.players[opponentColor].socketId;
        const opponentSocket = io.sockets.sockets.get(opponentSocketId);

        if (opponentSocket) {
          opponentSocket.emit('game:opponent-disconnected', {
            gameId: game.gameId,
            timeout: 60,
          });
        }
      }

      // Update online count
      io.to('lobby').emit('lobby:online-count', io.engine.clientsCount);
    });
  });
}

/**
 * Find a socket ID for a given userId by iterating connected sockets.
 */
function getSocketIdByUserId(io, userId) {
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.userId === userId) return socketId;
  }
  return null;
}

module.exports = { registerHandlers };
