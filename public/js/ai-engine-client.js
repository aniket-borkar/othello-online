/**
 * ai-engine-client.js
 * Client-side AI for single-player mode only.
 * Uses Othello.GameEngine functions.
 */
(function () {
  'use strict';

  window.Othello = window.Othello || {};

  var GE = null; // resolved lazily

  function engine() {
    if (!GE) GE = window.Othello.GameEngine;
    return GE;
  }

  var WEIGHTS = [
    [100, -20,  10,   5,   5,  10, -20, 100],
    [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
    [ 10,  -2,   1,   1,   1,   1,  -2,  10],
    [  5,  -2,   1,   0,   0,   1,  -2,   5],
    [  5,  -2,   1,   0,   0,   1,  -2,   5],
    [ 10,  -2,   1,   1,   1,   1,  -2,  10],
    [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
    [100, -20,  10,   5,   5,  10, -20, 100],
  ];

  function evaluate(b, maximizingColor) {
    var E = engine();
    var minimizingColor = E.opponent(maximizingColor);
    var scores = E.countDiscs(b);
    var total = scores.black + scores.white;

    // End-game: disc count matters most
    if (total > 55 || E.isGameOver(b)) {
      var myDiscs = maximizingColor === E.BLACK ? scores.black : scores.white;
      var oppDiscs = maximizingColor === E.BLACK ? scores.white : scores.black;
      return (myDiscs - oppDiscs) * 100;
    }

    // Positional score
    var pos = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        if (b[r][c] === maximizingColor) pos += WEIGHTS[r][c];
        else if (b[r][c] === minimizingColor) pos -= WEIGHTS[r][c];
      }
    }

    // Mobility
    var myMob = E.getValidMoves(b, maximizingColor).length;
    var oppMob = E.getValidMoves(b, minimizingColor).length;
    var mobility = (myMob - oppMob) * 5;

    // Corner occupancy
    var corners = 0;
    var cornerCells = [[0, 0], [0, 7], [7, 0], [7, 7]];
    for (var i = 0; i < cornerCells.length; i++) {
      var cr = cornerCells[i][0];
      var cc = cornerCells[i][1];
      if (b[cr][cc] === maximizingColor) corners += 25;
      else if (b[cr][cc] === minimizingColor) corners -= 25;
    }

    return pos + mobility + corners;
  }

  function minimax(b, depth, alpha, beta, maximizing, maximizingColor) {
    var E = engine();
    if (depth === 0 || E.isGameOver(b)) {
      return evaluate(b, maximizingColor);
    }

    var player = maximizing ? maximizingColor : E.opponent(maximizingColor);
    var moves = E.getValidMoves(b, player);

    if (moves.length === 0) {
      // Pass turn
      return minimax(b, depth - 1, alpha, beta, !maximizing, maximizingColor);
    }

    var i, r, c, nb, val;
    if (maximizing) {
      val = -Infinity;
      for (i = 0; i < moves.length; i++) {
        r = moves[i][0];
        c = moves[i][1];
        nb = E.applyMove(b, r, c, player).board;
        val = Math.max(val, minimax(nb, depth - 1, alpha, beta, false, maximizingColor));
        alpha = Math.max(alpha, val);
        if (alpha >= beta) break;
      }
      return val;
    } else {
      val = Infinity;
      for (i = 0; i < moves.length; i++) {
        r = moves[i][0];
        c = moves[i][1];
        nb = E.applyMove(b, r, c, player).board;
        val = Math.min(val, minimax(nb, depth - 1, alpha, beta, true, maximizingColor));
        beta = Math.min(beta, val);
        if (alpha >= beta) break;
      }
      return val;
    }
  }

  function aiEasy(board, playerColor) {
    var E = engine();
    var moves = E.getValidMoves(board, playerColor);
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function aiMedium(board, playerColor) {
    var E = engine();
    var moves = E.getValidMoves(board, playerColor);
    if (moves.length === 0) return null;
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var r = moves[i][0];
      var c = moves[i][1];
      var flips = E.getFlips(board, r, c, playerColor).length;
      var score = flips * 2 + WEIGHTS[r][c];
      if (score > bestScore) {
        bestScore = score;
        best = [r, c];
      }
    }
    return best;
  }

  function aiHard(board, playerColor) {
    var E = engine();
    var moves = E.getValidMoves(board, playerColor);
    if (moves.length === 0) return null;

    var totalDiscs = E.countDiscs(board);
    var filled = totalDiscs.black + totalDiscs.white;
    var depth = filled > 52 ? 8 : 5;

    var best = null;
    var bestVal = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var r = moves[i][0];
      var c = moves[i][1];
      var nb = E.applyMove(board, r, c, playerColor).board;
      var val = minimax(nb, depth - 1, -Infinity, Infinity, false, playerColor);
      if (val > bestVal) {
        bestVal = val;
        best = [r, c];
      }
    }
    return best;
  }

  function getBestMove(board, playerColor, difficulty) {
    switch (difficulty) {
      case 'easy':
        return aiEasy(board, playerColor);
      case 'medium':
        return aiMedium(board, playerColor);
      case 'hard':
        return aiHard(board, playerColor);
      default:
        return aiMedium(board, playerColor);
    }
  }

  window.Othello.AI = {
    getBestMove: getBestMove,
  };
})();
