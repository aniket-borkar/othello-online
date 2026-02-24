/**
 * game-engine-client.js
 * Client-side copy of the game engine for move previews and single-player.
 * Identical logic to server/game-engine.js but as browser globals.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;
  var DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  function cloneBoard(b) {
    return b.map(function (r) { return r.slice(); });
  }

  function opponent(p) {
    return p === BLACK ? WHITE : BLACK;
  }

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function getFlips(b, r, c, p) {
    if (b[r][c] !== EMPTY) return [];
    var opp = opponent(p);
    var allFlips = [];
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0];
      var dc = DIRS[d][1];
      var line = [];
      var nr = r + dr;
      var nc = c + dc;
      while (inBounds(nr, nc) && b[nr][nc] === opp) {
        line.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
      if (line.length > 0 && inBounds(nr, nc) && b[nr][nc] === p) {
        for (var i = 0; i < line.length; i++) {
          allFlips.push(line[i]);
        }
      }
    }
    return allFlips;
  }

  function getValidMoves(b, p) {
    var moves = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (getFlips(b, r, c, p).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  function applyMove(b, r, c, p) {
    var nb = cloneBoard(b);
    var flips = getFlips(nb, r, c, p);
    nb[r][c] = p;
    for (var i = 0; i < flips.length; i++) {
      nb[flips[i][0]][flips[i][1]] = p;
    }
    return { board: nb, flips: flips };
  }

  function countDiscs(b) {
    var black = 0;
    var white = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (b[r][c] === BLACK) black++;
        else if (b[r][c] === WHITE) white++;
      }
    }
    return { black: black, white: white };
  }

  function isGameOver(b) {
    return getValidMoves(b, BLACK).length === 0 && getValidMoves(b, WHITE).length === 0;
  }

  function createInitialBoard() {
    var board = [];
    for (var r = 0; r < 8; r++) {
      board.push([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
    }
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;
    return board;
  }

  window.Othello.GameEngine = {
    EMPTY: EMPTY,
    BLACK: BLACK,
    WHITE: WHITE,
    DIRS: DIRS,
    cloneBoard: cloneBoard,
    opponent: opponent,
    inBounds: inBounds,
    getFlips: getFlips,
    getValidMoves: getValidMoves,
    applyMove: applyMove,
    countDiscs: countDiscs,
    isGameOver: isGameOver,
    createInitialBoard: createInitialBoard,
  };
})();
