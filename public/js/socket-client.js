/**
 * socket-client.js
 * Socket.IO client wrapper. Handles all server communication.
 * Always uses WebSocket transport (required for Discord Activity proxy).
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var socket = null;
  var rooms = []; // local rooms cache

  function connect(sessionId) {
    if (socket && socket.connected) {
      socket.disconnect();
    }

    socket = io({
      auth: { sessionId: sessionId },
      transports: ['websocket'],
    });

    // --- Connection lifecycle ---

    socket.on('connect', function () {
      socket.emit('lobby:list', null, function (roomList) {
        if (roomList && Array.isArray(roomList)) {
          rooms = roomList;
          if (window.Othello.LobbyView) {
            window.Othello.LobbyView.updateRooms(rooms);
          }
        }
      });
    });

    socket.on('disconnect', function () {
      // Socket.IO auto-reconnects by default
    });

    // --- Lobby events ---

    socket.on('lobby:rooms', function (data) {
      rooms = data || [];
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateRooms(rooms);
      }
    });

    socket.on('lobby:room-created', function (room) {
      var exists = false;
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === room.id) {
          rooms[i] = room;
          exists = true;
          break;
        }
      }
      if (!exists) {
        rooms.push(room);
      }
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateRooms(rooms);
      }
    });

    socket.on('lobby:room-updated', function (room) {
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === room.id) {
          rooms[i] = room;
          break;
        }
      }
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateRooms(rooms);
      }
    });

    socket.on('lobby:room-removed', function (data) {
      var roomId = data.roomId;
      rooms = rooms.filter(function (r) { return r.id !== roomId; });
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateRooms(rooms);
      }
    });

    socket.on('lobby:online-count', function (count) {
      var c = typeof count === 'object' ? count.count : count;
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateOnlineCount(c);
      }
    });

    socket.on('lobby:quickmatch-waiting', function () {
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.setSearchingState(true);
      }
    });

    socket.on('lobby:quickmatch-found', function () {
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.setSearchingState(false);
      }
    });

    socket.on('lobby:error', function (data) {
      var msg = (data && data.message) || (data && data.error) || 'Lobby error.';
      if (window.Othello.LobbyView && window.Othello.LobbyView.showModal) {
        window.Othello.LobbyView.showModal({ title: 'Error', message: msg, confirmLabel: 'OK' });
      }
    });

    // --- Leaderboard ---

    socket.on('leaderboard:data', function (data) {
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateLeaderboard(data);
      }
    });

    // --- Game events ---

    socket.on('game:start', function (data) {
      if (window.Othello.App) {
        window.Othello.App.showView('game', {
          mode: 'multiplayer',
          gameId: data.gameId,
          yourColor: data.yourColor,
          opponent: data.opponent,
          board: data.board,
          currentPlayer: data.currentPlayer,
        });
      }
    });

    socket.on('game:reconnect', function (data) {
      if (window.Othello.App) {
        window.Othello.App.showView('game', {
          mode: 'multiplayer',
          gameId: data.gameId,
          yourColor: data.yourColor,
          opponent: data.opponent,
          board: data.board,
          currentPlayer: data.currentPlayer,
        });
      }
    });

    socket.on('game:move-made', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onMoveMade(data);
      }
    });

    socket.on('game:over', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onGameOver(data);
      }
    });

    socket.on('game:pass', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onPass(data);
      }
    });

    socket.on('game:opponent-disconnected', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onOpponentDisconnected(data);
      }
    });

    socket.on('game:opponent-reconnected', function () {
      if (window.Othello.GameView) {
        window.Othello.GameView.onOpponentReconnected();
      }
    });

    socket.on('game:opponent-resigned', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onGameOver({
          result: data.result,
          scores: data.scores,
          eloChanges: data.eloChanges,
          reason: 'resign',
        });
      }
    });

    socket.on('game:rematch-requested', function () {
      if (window.Othello.GameView) {
        window.Othello.GameView.onRematchOffered();
      }
    });

    socket.on('game:rematch-declined', function () {
      if (window.Othello.GameView) {
        window.Othello.GameView.setStatus('Rematch declined.', false);
      }
    });

    socket.on('game:error', function (data) {
      var msg = (data && data.message) || (data && data.error) || 'Game error.';
      if (window.Othello.GameView) {
        window.Othello.GameView.setStatus(msg, false);
      }
    });
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    rooms = [];
  }

  function emit(event, data, callback) {
    if (socket && socket.connected) {
      if (callback) {
        socket.emit(event, data, callback);
      } else {
        socket.emit(event, data);
      }
    }
  }

  function on(event, callback) {
    if (socket) {
      socket.on(event, callback);
    }
  }

  function getSocket() {
    return socket;
  }

  window.Othello.Socket = {
    connect: connect,
    disconnect: disconnect,
    emit: emit,
    on: on,
    getSocket: getSocket,
  };
})();
