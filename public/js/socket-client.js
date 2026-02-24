/**
 * socket-client.js
 * Socket.IO client wrapper. Handles all server communication.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var socket = null;
  var rooms = []; // local rooms cache
  var eventHandlers = {}; // custom event handlers registered via on()

  function connect(sessionId) {
    if (socket && socket.connected) {
      socket.disconnect();
    }

    var options = {
      auth: { sessionId: sessionId },
    };

    // In Discord Activity mode, force WebSocket transport (proxy doesn't support long-polling)
    if (window.Othello.Discord && window.Othello.Discord.isDiscordMode()) {
      options.transports = ['websocket'];
    }

    socket = io(options);

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
      if (window.Othello.App) {
        window.Othello.App.onConnected();
      }
    });

    socket.on('connect_error', function (err) {
      if (err && err.message && (
        err.message.indexOf('Authentication') !== -1 ||
        err.message.indexOf('Invalid') !== -1 ||
        err.message.indexOf('expired') !== -1
      )) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        if (window.Othello.App) {
          window.Othello.App.showView('auth');
        }
      }
    });

    socket.on('disconnect', function () {
      // Could show a reconnecting indicator; Socket.IO auto-reconnects by default
    });

    // --- Lobby events ---

    socket.on('lobby:rooms', function (data) {
      rooms = data || [];
      if (window.Othello.LobbyView) {
        window.Othello.LobbyView.updateRooms(rooms);
      }
    });

    socket.on('lobby:room-created', function (room) {
      // Add to local cache
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
      // The server sends either a number directly or an object with .count
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
      alert(msg);
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

    socket.on('game:rematch-requested', function (data) {
      if (window.Othello.GameView) {
        window.Othello.GameView.onRematchOffered();
      }
    });

    socket.on('game:rematch-declined', function (data) {
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
    // Store for late-binding if socket isn't ready
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(callback);
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
