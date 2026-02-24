/**
 * lobby-view.js
 * Lobby with rooms, quick-match, leaderboard.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var container = null;
  var currentUser = null;
  var isSearching = false;

  function render(parentContainer, user) {
    container = parentContainer;
    currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
    isSearching = false;

    if (!currentUser) {
      window.Othello.App.showView('auth');
      return;
    }

    var html = '' +
      '<div class="lobby-container">' +
        '<h1 class="logo">OTHELLO</h1>' +
        '<!-- Header -->' +
        '<div class="lobby-header">' +
          '<div class="lobby-user-info">' +
            '<div class="user-avatar">' + escapeHtml((currentUser.username || '?')[0].toUpperCase()) + '</div>' +
            '<span class="username">' + escapeHtml(currentUser.username) + '</span>' +
            '<span class="elo-badge">' + (currentUser.elo || 1200) + ' ELO</span>' +
            '<span class="online-count" id="online-count">0 online</span>' +
          '</div>' +
          '' +
        '</div>' +
        '<!-- Content (two-column grid) -->' +
        '<div class="lobby-content">' +
          '<div class="lobby-main">' +
            '<!-- Actions -->' +
            '<div class="lobby-actions">' +
              '<button class="btn btn-primary" id="create-room-btn">Create Room</button>' +
              '<button class="quick-match-btn" id="quick-match-btn">Quick Match</button>' +
              '<button class="btn btn-secondary" id="play-ai-btn">Play vs AI</button>' +
            '</div>' +
            '<!-- Rooms -->' +
            '<div class="rooms-section">' +
              '<h2>Open Rooms</h2>' +
              '<div class="rooms-grid" id="rooms-grid">' +
                '<div class="lobby-empty">No rooms available. Create one!</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="lobby-sidebar">' +
            '<!-- Leaderboard -->' +
            '<div class="leaderboard-section">' +
              '<h2>Leaderboard</h2>' +
              '<table class="leaderboard-table" id="leaderboard-table">' +
                '<thead><tr><th>#</th><th>Player</th><th>ELO</th><th>W</th><th>L</th><th>D</th></tr></thead>' +
                '<tbody id="leaderboard-body">' +
                  '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">Loading...</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    container.querySelector('#create-room-btn').addEventListener('click', function () {
      var name = prompt('Room name:', currentUser.username + "'s Room");
      if (name === null) return; // cancelled
      if (!name.trim()) name = currentUser.username + "'s Room";
      window.Othello.Socket.emit('lobby:create', { name: name.trim() });
    });

    container.querySelector('#quick-match-btn').addEventListener('click', function () {
      var btn = this;
      if (isSearching) {
        // Cancel
        isSearching = false;
        btn.classList.remove('searching');
        btn.textContent = 'Quick Match';
        window.Othello.Socket.emit('lobby:cancel-quickmatch');
      } else {
        // Start searching
        isSearching = true;
        btn.classList.add('searching');
        btn.textContent = 'Searching...';
        window.Othello.Socket.emit('lobby:quickmatch');
      }
    });

    container.querySelector('#play-ai-btn').addEventListener('click', function () {
      window.Othello.App.showView('game', { mode: 'singleplayer' });
    });

    // Request initial data
    window.Othello.Socket.emit('lobby:list', null, function (rooms) {
      if (rooms && Array.isArray(rooms)) {
        updateRooms(rooms);
      }
    });

    window.Othello.Socket.emit('leaderboard:request', { limit: 20 }, function (data) {
      if (data) {
        updateLeaderboard(data);
      }
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateRooms(rooms) {
    if (!container) return;
    var grid = container.querySelector('#rooms-grid');
    if (!grid) return;

    if (!rooms || rooms.length === 0) {
      grid.innerHTML = '<div class="lobby-empty">No rooms available. Create one!</div>';
      return;
    }

    var user = currentUser || JSON.parse(localStorage.getItem('user') || 'null');
    var userId = user ? user.id : null;
    var html = '';

    for (var i = 0; i < rooms.length; i++) {
      var room = rooms[i];
      var isHost = room.hostId === userId;
      var isGuest = room.guestId === userId;
      var statusHtml = '';
      var actionHtml = '';

      if (room.status === 'waiting') {
        statusHtml = '<span class="waiting">Waiting for opponent...</span>';
        if (!isHost) {
          actionHtml = '<button class="btn btn-primary join-room-btn" data-room-id="' + room.id + '">Join</button>';
        }
      } else if (room.status === 'full') {
        statusHtml = '<span class="waiting">Room full</span>';
        if (isHost) {
          actionHtml = '<button class="btn btn-primary start-room-btn" data-room-id="' + room.id + '">Start</button>';
        }
      } else {
        statusHtml = '<span class="in-progress">In Progress</span>';
      }

      html += '' +
        '<div class="room-card">' +
          '<div class="room-host">' + escapeHtml(room.name || room.hostUsername + "'s room") + '</div>' +
          '<div class="room-elo">' + escapeHtml(room.hostUsername) + ' (' + (room.hostElo || 1200) + ' ELO)' +
            (room.guestUsername ? ' vs ' + escapeHtml(room.guestUsername) + ' (' + (room.guestElo || 1200) + ' ELO)' : '') +
          '</div>' +
          '<div class="room-status">' + statusHtml + actionHtml + '</div>' +
        '</div>';
    }

    grid.innerHTML = html;

    // Bind join buttons
    var joinBtns = grid.querySelectorAll('.join-room-btn');
    for (var j = 0; j < joinBtns.length; j++) {
      joinBtns[j].addEventListener('click', function () {
        var roomId = this.getAttribute('data-room-id');
        window.Othello.Socket.emit('lobby:join', { roomId: roomId });
      });
    }

    // Bind start buttons
    var startBtns = grid.querySelectorAll('.start-room-btn');
    for (var k = 0; k < startBtns.length; k++) {
      startBtns[k].addEventListener('click', function () {
        var roomId = this.getAttribute('data-room-id');
        window.Othello.Socket.emit('lobby:start', { roomId: roomId });
      });
    }
  }

  function updateOnlineCount(count) {
    if (!container) return;
    var el = container.querySelector('#online-count');
    if (el) el.textContent = count + ' online';
  }

  function updateLeaderboard(data) {
    if (!container) return;
    var tbody = container.querySelector('#leaderboard-body');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">No players yet.</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      var rank = i + 1;
      var rankClass = rank <= 3 ? ' class="rank-' + rank + '"' : '';
      html += '<tr>' +
        '<td' + rankClass + '>' + rank + '</td>' +
        '<td>' + escapeHtml(p.username) + '</td>' +
        '<td>' + (p.elo || 1200) + '</td>' +
        '<td>' + (p.wins || 0) + '</td>' +
        '<td>' + (p.losses || 0) + '</td>' +
        '<td>' + (p.draws || 0) + '</td>' +
      '</tr>';
    }

    tbody.innerHTML = html;
  }

  function setSearchingState(searching) {
    isSearching = searching;
    if (!container) return;
    var btn = container.querySelector('#quick-match-btn');
    if (!btn) return;
    if (searching) {
      btn.classList.add('searching');
      btn.textContent = 'Searching...';
    } else {
      btn.classList.remove('searching');
      btn.textContent = 'Quick Match';
    }
  }

  function destroy() {
    container = null;
    currentUser = null;
    isSearching = false;
  }

  window.Othello.LobbyView = {
    render: render,
    destroy: destroy,
    updateRooms: updateRooms,
    updateOnlineCount: updateOnlineCount,
    updateLeaderboard: updateLeaderboard,
    setSearchingState: setSearchingState,
  };
})();
