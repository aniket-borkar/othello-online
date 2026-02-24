/**
 * game-view.js
 * The main game board view for both multiplayer and singleplayer modes.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var container = null;
  var gameState = null; // { mode, gameId, yourColor, opponentColor, board, currentPlayer, difficulty, opponent }
  var GE = null;
  var animating = false;
  var lastMove = null;
  var lastFlips = [];

  function engine() {
    if (!GE) GE = window.Othello.GameEngine;
    return GE;
  }

  function render(parentContainer, options) {
    container = parentContainer;
    var E = engine();
    animating = false;
    lastMove = null;
    lastFlips = [];

    if (options.mode === 'multiplayer') {
      gameState = {
        mode: 'multiplayer',
        gameId: options.gameId,
        yourColor: options.yourColor,
        opponentColor: options.yourColor === E.BLACK ? E.WHITE : E.BLACK,
        board: options.board,
        currentPlayer: options.currentPlayer,
        opponent: options.opponent || { username: 'Opponent', elo: 1200 },
        difficulty: null,
      };
    } else {
      // Singleplayer
      gameState = {
        mode: 'singleplayer',
        gameId: null,
        yourColor: E.BLACK,
        opponentColor: E.WHITE,
        board: E.createInitialBoard(),
        currentPlayer: E.BLACK,
        opponent: { username: 'AI', elo: null },
        difficulty: options.difficulty || 'medium',
      };
    }

    var user = window.Othello.App.getCurrentUser() || { username: 'You', elo: 1200 };
    var yourName = user.username;
    var yourElo = user.elo || 1200;
    var oppName = gameState.opponent.username;
    var oppElo = gameState.opponent.elo;

    var yourColorLabel = gameState.yourColor === E.BLACK ? 'Black' : 'White';
    var oppColorLabel = gameState.opponentColor === E.BLACK ? 'Black' : 'White';

    var scores = E.countDiscs(gameState.board);
    var yourScore = gameState.yourColor === E.BLACK ? scores.black : scores.white;
    var oppScore = gameState.opponentColor === E.BLACK ? scores.black : scores.white;

    // Difficulty selector HTML (only for singleplayer)
    var difficultyHtml = '';
    if (gameState.mode === 'singleplayer') {
      difficultyHtml = '' +
        '<div style="margin-bottom:0.5rem;text-align:center;">' +
          '<label for="difficulty-select" class="text-secondary" style="font-size:0.85rem;margin-right:0.5rem;">Difficulty:</label>' +
          '<select id="difficulty-select" class="input-field" style="width:auto;display:inline-block;padding:0.4rem 0.8rem;font-size:0.85rem;">' +
            '<option value="easy"' + (gameState.difficulty === 'easy' ? ' selected' : '') + '>Easy</option>' +
            '<option value="medium"' + (gameState.difficulty === 'medium' ? ' selected' : '') + '>Medium</option>' +
            '<option value="hard"' + (gameState.difficulty === 'hard' ? ' selected' : '') + '>Hard</option>' +
          '</select>' +
        '</div>';
    }

    var html = '' +
      '<div class="game-container">' +
        difficultyHtml +
        '<!-- Game Header -->' +
        '<div class="game-header">' +
          '<div class="game-player-info" id="player-left">' +
            '<span class="player-name">' + escapeHtml(yourName) + '</span>' +
            (gameState.mode === 'multiplayer' ? '<span class="player-elo">' + yourElo + ' ELO</span>' : '') +
            '<span class="disc-count" id="your-score">' + yourScore + '</span>' +
            '<span class="text-secondary" style="font-size:0.75rem;">' + yourColorLabel + '</span>' +
          '</div>' +
          '<div class="game-vs">VS</div>' +
          '<div class="game-player-info" id="player-right">' +
            '<span class="player-name">' + escapeHtml(oppName) + '</span>' +
            (oppElo != null ? '<span class="player-elo">' + oppElo + ' ELO</span>' : '') +
            '<span class="disc-count" id="opp-score">' + oppScore + '</span>' +
            '<span class="text-secondary" style="font-size:0.75rem;">' + oppColorLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<!-- Status -->' +
        '<div class="game-status" id="game-status"></div>' +
        '<!-- Board Wrapper -->' +
        '<div class="board-wrapper">' +
          '<div class="board-coords-top">' +
            '<span>a</span><span>b</span><span>c</span><span>d</span>' +
            '<span>e</span><span>f</span><span>g</span><span>h</span>' +
          '</div>' +
          '<div class="board-coords-bottom">' +
            '<span>a</span><span>b</span><span>c</span><span>d</span>' +
            '<span>e</span><span>f</span><span>g</span><span>h</span>' +
          '</div>' +
          '<div class="board-coords-left">' +
            '<span>1</span><span>2</span><span>3</span><span>4</span>' +
            '<span>5</span><span>6</span><span>7</span><span>8</span>' +
          '</div>' +
          '<div class="board-coords-right">' +
            '<span>1</span><span>2</span><span>3</span><span>4</span>' +
            '<span>5</span><span>6</span><span>7</span><span>8</span>' +
          '</div>' +
          '<div class="board" id="game-board"></div>' +
        '</div>' +
        '<!-- Game Actions -->' +
        '<div class="game-actions">' +
          (gameState.mode === 'multiplayer'
            ? '<button class="btn btn-danger" id="resign-btn">Resign</button>'
            : '<button class="btn btn-primary" id="new-game-btn">New Game</button>') +
          '<button class="btn btn-secondary" id="back-lobby-btn">Back to Lobby</button>' +
        '</div>' +
        '<!-- Game Over Overlay -->' +
        '<div class="game-overlay" id="game-overlay">' +
          '<div class="game-overlay-box">' +
            '<h2 id="overlay-title"></h2>' +
            '<div class="result-score" id="overlay-score"></div>' +
            '<div class="elo-change" id="overlay-elo"></div>' +
            '<div class="overlay-buttons" id="overlay-buttons"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    // Build the board cells
    var boardEl = container.querySelector('#game-board');
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        // Star points at corners of center 4 squares
        if ((r === 2 && c === 2) || (r === 2 && c === 5) || (r === 5 && c === 2) || (r === 5 && c === 5)) {
          cell.classList.add('star-point');
        }
        boardEl.appendChild(cell);
      }
    }

    // Board click handler
    boardEl.addEventListener('click', onBoardClick);

    // Action button handlers
    if (gameState.mode === 'multiplayer') {
      container.querySelector('#resign-btn').addEventListener('click', function () {
        if (confirm('Are you sure you want to resign?')) {
          window.Othello.Socket.emit('game:resign', { gameId: gameState.gameId });
        }
      });
    } else {
      container.querySelector('#new-game-btn').addEventListener('click', function () {
        var diff = gameState.difficulty || 'medium';
        window.Othello.App.showView('game', { mode: 'singleplayer', difficulty: diff });
      });
    }

    container.querySelector('#back-lobby-btn').addEventListener('click', function () {
      window.Othello.App.showView('lobby');
    });

    // Difficulty selector change
    if (gameState.mode === 'singleplayer') {
      var diffSelect = container.querySelector('#difficulty-select');
      if (diffSelect) {
        diffSelect.addEventListener('change', function () {
          gameState.difficulty = this.value;
        });
      }
    }

    // Initial render
    renderBoard(gameState.board, null, [], false);
    updateTurnIndicator();
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function onBoardClick(e) {
    if (animating) return;
    var E = engine();

    var cell = e.target.closest('.cell');
    if (!cell) return;

    var row = parseInt(cell.getAttribute('data-row'), 10);
    var col = parseInt(cell.getAttribute('data-col'), 10);

    // Check it's our turn
    if (gameState.currentPlayer !== gameState.yourColor) return;

    // Check it's a valid move
    var flips = E.getFlips(gameState.board, row, col, gameState.yourColor);
    if (flips.length === 0) return;

    if (gameState.mode === 'multiplayer') {
      // Emit to server, wait for server response
      window.Othello.Socket.emit('game:move', {
        gameId: gameState.gameId,
        row: row,
        col: col,
      });
    } else {
      // Singleplayer: apply move locally
      handleSingleplayerMove(row, col);
    }
  }

  function handleSingleplayerMove(row, col) {
    var E = engine();
    animating = true;

    var result = E.applyMove(gameState.board, row, col, gameState.yourColor);
    gameState.board = result.board;
    var scores = E.countDiscs(gameState.board);

    lastMove = [row, col];
    lastFlips = result.flips;
    renderBoard(gameState.board, [row, col], result.flips, true);
    updateScores(scores);

    // Check game over
    if (E.isGameOver(gameState.board)) {
      gameState.currentPlayer = null;
      updateTurnIndicator();
      animating = false;
      handleSingleplayerGameOver(scores);
      return;
    }

    // Switch turn
    var nextPlayer = E.opponent(gameState.yourColor);
    var nextMoves = E.getValidMoves(gameState.board, nextPlayer);

    if (nextMoves.length > 0) {
      gameState.currentPlayer = nextPlayer;
      updateTurnIndicator();

      // AI makes a move after a delay
      setTimeout(function () {
        doAiMove();
      }, 600);
    } else {
      // AI has no moves, check if player can still move
      var playerMoves = E.getValidMoves(gameState.board, gameState.yourColor);
      if (playerMoves.length > 0) {
        // AI passes, player keeps turn
        gameState.currentPlayer = gameState.yourColor;
        setStatus('AI passed! Your turn.', true);
        animating = false;
        renderBoard(gameState.board, lastMove, [], false);
      } else {
        // Neither can move -> game over
        gameState.currentPlayer = null;
        updateTurnIndicator();
        animating = false;
        handleSingleplayerGameOver(scores);
      }
    }
  }

  function doAiMove() {
    var E = engine();
    var AI = window.Othello.AI;

    var move = AI.getBestMove(gameState.board, gameState.opponentColor, gameState.difficulty);
    if (!move) {
      // AI can't move, check if player can
      var playerMoves = E.getValidMoves(gameState.board, gameState.yourColor);
      if (playerMoves.length > 0) {
        gameState.currentPlayer = gameState.yourColor;
        setStatus('AI passed! Your turn.', true);
        animating = false;
        renderBoard(gameState.board, lastMove, [], false);
      } else {
        var scores = E.countDiscs(gameState.board);
        gameState.currentPlayer = null;
        animating = false;
        handleSingleplayerGameOver(scores);
      }
      return;
    }

    var result = E.applyMove(gameState.board, move[0], move[1], gameState.opponentColor);
    gameState.board = result.board;
    var scores = E.countDiscs(gameState.board);

    lastMove = move;
    lastFlips = result.flips;
    renderBoard(gameState.board, move, result.flips, true);
    updateScores(scores);

    // Check game over after AI move
    if (E.isGameOver(gameState.board)) {
      gameState.currentPlayer = null;
      updateTurnIndicator();
      animating = false;
      handleSingleplayerGameOver(scores);
      return;
    }

    // Switch turn back to player
    var nextPlayer = E.opponent(gameState.opponentColor);
    var nextMoves = E.getValidMoves(gameState.board, nextPlayer);

    if (nextMoves.length > 0) {
      gameState.currentPlayer = nextPlayer;
      updateTurnIndicator();
      animating = false;
      renderBoard(gameState.board, lastMove, [], false);
    } else {
      // Player has no moves, AI goes again
      var aiMoves = E.getValidMoves(gameState.board, gameState.opponentColor);
      if (aiMoves.length > 0) {
        gameState.currentPlayer = gameState.opponentColor;
        setStatus('You passed! AI is thinking...', false);
        setTimeout(function () {
          doAiMove();
        }, 600);
      } else {
        gameState.currentPlayer = null;
        animating = false;
        handleSingleplayerGameOver(scores);
      }
    }
  }

  function handleSingleplayerGameOver(scores) {
    var E = engine();
    var yourScore = gameState.yourColor === E.BLACK ? scores.black : scores.white;
    var oppScore = gameState.opponentColor === E.BLACK ? scores.black : scores.white;

    var resultStr;
    if (yourScore > oppScore) resultStr = 'win';
    else if (oppScore > yourScore) resultStr = 'loss';
    else resultStr = 'draw';

    showGameOverOverlay({
      title: resultStr === 'win' ? 'You Win!' : resultStr === 'loss' ? 'You Lose!' : 'Draw!',
      scoreText: yourScore + ' - ' + oppScore,
      eloText: null,
      eloClass: '',
      isSingleplayer: true,
      isWin: resultStr === 'win',
    });
  }

  function renderBoard(board, newMove, flips, isNewDisc) {
    if (!container) return;
    var E = engine();
    var boardEl = container.querySelector('#game-board');
    if (!boardEl) return;

    var validMoves = [];
    var isMyTurn = gameState.currentPlayer === gameState.yourColor;
    if (isMyTurn && gameState.currentPlayer != null) {
      validMoves = E.getValidMoves(board, gameState.yourColor);
    }

    // Build a set for quick valid-move lookups
    var validSet = {};
    for (var v = 0; v < validMoves.length; v++) {
      validSet[validMoves[v][0] + ',' + validMoves[v][1]] = true;
    }

    // Build a set for flips
    var flipSet = {};
    if (flips) {
      for (var f = 0; f < flips.length; f++) {
        flipSet[flips[f][0] + ',' + flips[f][1]] = true;
      }
    }

    var cells = boardEl.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var r = parseInt(cell.getAttribute('data-row'), 10);
      var c = parseInt(cell.getAttribute('data-col'), 10);
      var key = r + ',' + c;
      var discVal = board[r][c];

      // Clear valid / last-move classes
      cell.classList.remove('valid', 'last-move');

      // Show valid move hints (only when it's our turn)
      if (validSet[key] && !isNewDisc) {
        cell.classList.add('valid');
      }

      // Show last move marker
      if (newMove && newMove[0] === r && newMove[1] === c) {
        cell.classList.add('last-move');
      }

      // Handle disc
      var existingDisc = cell.querySelector('.disc');

      if (discVal === E.EMPTY) {
        if (existingDisc) {
          cell.removeChild(existingDisc);
        }
      } else {
        var colorClass = discVal === E.BLACK ? 'black' : 'white';

        if (existingDisc) {
          // Check if disc color changed (flipped)
          var wasBlack = existingDisc.classList.contains('black');
          var nowBlack = discVal === E.BLACK;

          if (wasBlack !== nowBlack) {
            // Disc was flipped
            existingDisc.className = 'disc ' + colorClass;
            if (isNewDisc && flipSet[key]) {
              existingDisc.classList.add('flipping');
              spawnCaptureParticles(cell, colorClass);
              (function (d) {
                setTimeout(function () { d.classList.remove('flipping'); }, 500);
              })(existingDisc);
            }
          } else {
            existingDisc.className = 'disc ' + colorClass;
          }
        } else {
          // Create new disc
          var disc = document.createElement('div');
          disc.className = 'disc ' + colorClass;

          if (isNewDisc && newMove && newMove[0] === r && newMove[1] === c) {
            disc.classList.add('placing');
            setTimeout(function (d) {
              return function () { d.classList.remove('placing'); };
            }(disc), 350);
          }

          cell.appendChild(disc);
        }
      }
    }
  }

  function spawnCaptureParticles(cell, colorClass) {
    var particleColor = colorClass === 'black' ? '#555' : '#ddd';
    var count = 4 + Math.floor(Math.random() * 3); // 4-6 particles

    for (var i = 0; i < count; i++) {
      var particle = document.createElement('span');
      particle.className = 'capture-particle';
      particle.style.background = particleColor;

      var px = (Math.random() - 0.5) * 60;
      var py = (Math.random() - 0.5) * 60;
      particle.style.setProperty('--px', px + 'px');
      particle.style.setProperty('--py', py + 'px');
      particle.style.left = '50%';
      particle.style.top = '50%';

      cell.appendChild(particle);

      // Remove after animation
      (function (p) {
        setTimeout(function () {
          if (p.parentNode) p.parentNode.removeChild(p);
        }, 600);
      })(particle);
    }
  }

  function updateScores(scores) {
    if (!container || !gameState) return;
    var E = engine();
    var yourScore = gameState.yourColor === E.BLACK ? scores.black : scores.white;
    var oppScore = gameState.opponentColor === E.BLACK ? scores.black : scores.white;

    var yourEl = container.querySelector('#your-score');
    var oppEl = container.querySelector('#opp-score');
    if (yourEl) yourEl.textContent = yourScore;
    if (oppEl) oppEl.textContent = oppScore;
  }

  function updateTurnIndicator() {
    if (!container || !gameState) return;
    var E = engine();
    var leftPanel = container.querySelector('#player-left');
    var rightPanel = container.querySelector('#player-right');

    if (leftPanel) leftPanel.classList.remove('active');
    if (rightPanel) rightPanel.classList.remove('active');

    if (gameState.currentPlayer === null) {
      setStatus('Game Over', false);
      return;
    }

    if (gameState.currentPlayer === gameState.yourColor) {
      if (leftPanel) leftPanel.classList.add('active');
      setStatus('Your turn', true);
    } else {
      if (rightPanel) rightPanel.classList.add('active');
      if (gameState.mode === 'singleplayer') {
        setStatus('AI is thinking...', false);
      } else {
        setStatus(gameState.opponent.username + "'s turn", false);
      }
    }
  }

  function setStatus(text, isHighlight) {
    if (!container) return;
    var statusEl = container.querySelector('#game-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    if (isHighlight) {
      statusEl.classList.add('your-turn');
    } else {
      statusEl.classList.remove('your-turn');
    }
  }

  function showGameOverOverlay(opts) {
    if (!container) return;
    var overlay = container.querySelector('#game-overlay');
    if (!overlay) return;

    var titleEl = container.querySelector('#overlay-title');
    var scoreEl = container.querySelector('#overlay-score');
    var eloEl = container.querySelector('#overlay-elo');
    var buttonsEl = container.querySelector('#overlay-buttons');

    if (titleEl) titleEl.textContent = opts.title || 'Game Over';
    if (scoreEl) scoreEl.textContent = opts.scoreText || '';

    if (eloEl) {
      if (opts.eloText) {
        eloEl.textContent = opts.eloText;
        eloEl.className = 'elo-change' + (opts.eloClass ? ' ' + opts.eloClass : '');
      } else {
        eloEl.textContent = '';
        eloEl.className = 'elo-change';
      }
    }

    // Build buttons
    var buttonsHtml = '';
    if (opts.isSingleplayer) {
      buttonsHtml += '<button class="btn btn-primary" id="overlay-play-again">Play Again</button>';
    } else {
      buttonsHtml += '<button class="btn btn-primary" id="overlay-rematch">Rematch</button>';
    }
    buttonsHtml += '<button class="btn btn-secondary" id="overlay-back-lobby">Back to Lobby</button>';

    if (buttonsEl) buttonsEl.innerHTML = buttonsHtml;

    overlay.classList.add('active');

    // Button handlers
    var playAgainBtn = container.querySelector('#overlay-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', function () {
        var diff = gameState ? gameState.difficulty : 'medium';
        window.Othello.App.showView('game', { mode: 'singleplayer', difficulty: diff });
      });
    }

    var rematchBtn = container.querySelector('#overlay-rematch');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', function () {
        if (gameState && gameState.gameId) {
          window.Othello.Socket.emit('game:rematch-request', { gameId: gameState.gameId });
          rematchBtn.disabled = true;
          rematchBtn.textContent = 'Waiting...';
        }
      });
    }

    var backBtn = container.querySelector('#overlay-back-lobby');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.Othello.App.showView('lobby');
      });
    }

    // Spawn confetti on win
    if (opts.isWin) {
      spawnConfetti();
    }
  }

  function spawnConfetti() {
    var colors = ['#4ecca3', '#ffd700', '#e94560', '#66d9c0', '#fff', '#3bb08f'];
    for (var i = 0; i < 40; i++) {
      (function (idx) {
        setTimeout(function () {
          var conf = document.createElement('div');
          conf.className = 'confetti';
          conf.style.left = Math.random() * 100 + 'vw';
          conf.style.top = '-10px';
          conf.style.background = colors[Math.floor(Math.random() * colors.length)];
          conf.style.setProperty('--duration', (2 + Math.random() * 2) + 's');
          conf.style.setProperty('--rotation', (Math.random() * 720 - 360) + 'deg');
          conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
          conf.style.width = (6 + Math.random() * 6) + 'px';
          conf.style.height = (6 + Math.random() * 6) + 'px';
          document.body.appendChild(conf);
          setTimeout(function () {
            if (conf.parentNode) conf.parentNode.removeChild(conf);
          }, 4000);
        }, idx * 50);
      })(i);
    }
  }

  // --- Public event handlers (called by socket-client or app) ---

  function onMoveMade(data) {
    if (!gameState) return;
    var E = engine();

    gameState.board = data.board;
    gameState.currentPlayer = data.currentPlayer;

    var moveCoord = data.move; // [row, col]
    var flips = data.flips || [];

    lastMove = moveCoord;
    lastFlips = flips;

    animating = true;
    renderBoard(gameState.board, moveCoord, flips, true);

    if (data.scores) {
      updateScores(data.scores);
    }

    // After animation, show valid moves
    setTimeout(function () {
      animating = false;
      renderBoard(gameState.board, lastMove, [], false);
      updateTurnIndicator();
    }, 550);
  }

  function onGameOver(data) {
    if (!gameState) return;
    var E = engine();

    gameState.currentPlayer = null;
    updateTurnIndicator();

    var scores = data.scores || E.countDiscs(gameState.board);
    var yourScore = gameState.yourColor === E.BLACK ? scores.black : scores.white;
    var oppScore = gameState.opponentColor === E.BLACK ? scores.black : scores.white;

    var resultStr = data.result; // 'black', 'white', 'draw'
    var isWin = false;
    var title = 'Draw!';

    if (resultStr === 'draw') {
      title = 'Draw!';
    } else {
      var winnerColor = resultStr === 'black' ? E.BLACK : E.WHITE;
      if (winnerColor === gameState.yourColor) {
        title = 'You Win!';
        isWin = true;
      } else {
        title = 'You Lose!';
      }
    }

    if (data.reason === 'resign') {
      if (isWin) {
        title = 'Opponent Resigned!';
      } else {
        title = 'You Resigned';
      }
    }

    // ELO change
    var eloText = null;
    var eloClass = '';
    if (data.eloChanges) {
      var colorKey = gameState.yourColor === E.BLACK ? 'black' : 'white';
      var change = data.eloChanges[colorKey];
      if (change) {
        var diff = change.diff || (change.after - change.before);
        if (diff > 0) {
          eloText = 'ELO: ' + change.after + ' (+' + diff + ')';
          eloClass = 'positive';
        } else if (diff < 0) {
          eloText = 'ELO: ' + change.after + ' (' + diff + ')';
          eloClass = 'negative';
        } else {
          eloText = 'ELO: ' + change.after + ' (+0)';
        }

        // Update local user ELO
        try {
          var storedUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (storedUser) {
            storedUser.elo = change.after;
            localStorage.setItem('user', JSON.stringify(storedUser));
          }
        } catch (e) { /* ignore */ }
      }
    }

    showGameOverOverlay({
      title: title,
      scoreText: yourScore + ' - ' + oppScore,
      eloText: eloText,
      eloClass: eloClass,
      isSingleplayer: false,
      isWin: isWin,
    });
  }

  function onOpponentDisconnected(data) {
    setStatus('Opponent disconnected. Waiting ' + (data.timeout || 60) + 's...', false);
  }

  function onOpponentReconnected() {
    updateTurnIndicator();
  }

  function onPass(data) {
    if (!gameState) return;
    var E = engine();
    gameState.currentPlayer = data.currentPlayer;

    var passedColor = data.passedPlayer === E.BLACK ? 'Black' : 'White';
    setStatus(passedColor + ' passed!', false);

    setTimeout(function () {
      updateTurnIndicator();
      renderBoard(gameState.board, lastMove, [], false);
    }, 1500);
  }

  function onRematchOffered() {
    if (!container) return;
    var rematchBtn = container.querySelector('#overlay-rematch');
    if (rematchBtn) {
      rematchBtn.disabled = false;
      rematchBtn.textContent = 'Accept Rematch';
      rematchBtn.onclick = function () {
        if (gameState && gameState.gameId) {
          window.Othello.Socket.emit('game:rematch-accept', { gameId: gameState.gameId });
        }
      };
    }
  }

  function destroy() {
    container = null;
    gameState = null;
    animating = false;
    lastMove = null;
    lastFlips = [];
  }

  window.Othello.GameView = {
    render: render,
    destroy: destroy,
    onMoveMade: onMoveMade,
    onGameOver: onGameOver,
    onOpponentDisconnected: onOpponentDisconnected,
    onOpponentReconnected: onOpponentReconnected,
    onPass: onPass,
    onRematchOffered: onRematchOffered,
    setStatus: setStatus,
  };
})();
