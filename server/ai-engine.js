'use strict';

const {
  EMPTY, BLACK, WHITE,
  cloneBoard, opponent, getFlips, getValidMoves, applyMove, countDiscs, isGameOver,
} = require('./game-engine');

const WEIGHTS = [
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
  const minimizingColor = opponent(maximizingColor);
  const scores = countDiscs(b);
  const total = scores.black + scores.white;

  // End-game: disc count matters most
  if (total > 55 || isGameOver(b)) {
    const myDiscs = maximizingColor === BLACK ? scores.black : scores.white;
    const oppDiscs = maximizingColor === BLACK ? scores.white : scores.black;
    return (myDiscs - oppDiscs) * 100;
  }

  // Positional score
  let pos = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === maximizingColor) pos += WEIGHTS[r][c];
      else if (b[r][c] === minimizingColor) pos -= WEIGHTS[r][c];
    }
  }

  // Mobility
  const myMob = getValidMoves(b, maximizingColor).length;
  const oppMob = getValidMoves(b, minimizingColor).length;
  const mobility = (myMob - oppMob) * 5;

  // Corner occupancy
  let corners = 0;
  const cornerCells = [[0, 0], [0, 7], [7, 0], [7, 7]];
  for (const [cr, cc] of cornerCells) {
    if (b[cr][cc] === maximizingColor) corners += 25;
    else if (b[cr][cc] === minimizingColor) corners -= 25;
  }

  return pos + mobility + corners;
}

function minimax(b, depth, alpha, beta, maximizing, maximizingColor) {
  if (depth === 0 || isGameOver(b)) {
    return evaluate(b, maximizingColor);
  }

  const player = maximizing ? maximizingColor : opponent(maximizingColor);
  const moves = getValidMoves(b, player);

  if (moves.length === 0) {
    // Pass turn
    return minimax(b, depth - 1, alpha, beta, !maximizing, maximizingColor);
  }

  if (maximizing) {
    let val = -Infinity;
    for (const [r, c] of moves) {
      const { board: nb } = applyMove(b, r, c, player);
      val = Math.max(val, minimax(nb, depth - 1, alpha, beta, false, maximizingColor));
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return val;
  } else {
    let val = Infinity;
    for (const [r, c] of moves) {
      const { board: nb } = applyMove(b, r, c, player);
      val = Math.min(val, minimax(nb, depth - 1, alpha, beta, true, maximizingColor));
      beta = Math.min(beta, val);
      if (alpha >= beta) break;
    }
    return val;
  }
}

function aiEasy(board, playerColor) {
  const moves = getValidMoves(board, playerColor);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function aiMedium(board, playerColor) {
  const moves = getValidMoves(board, playerColor);
  if (moves.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const [r, c] of moves) {
    const flips = getFlips(board, r, c, playerColor).length;
    const score = flips * 2 + WEIGHTS[r][c];
    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
    }
  }
  return best;
}

function aiHard(board, playerColor) {
  const moves = getValidMoves(board, playerColor);
  if (moves.length === 0) return null;

  const totalDiscs = countDiscs(board);
  const filled = totalDiscs.black + totalDiscs.white;
  const depth = filled > 52 ? 8 : 5;

  let best = null;
  let bestVal = -Infinity;
  for (const [r, c] of moves) {
    const { board: nb } = applyMove(board, r, c, playerColor);
    const val = minimax(nb, depth - 1, -Infinity, Infinity, false, playerColor);
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

module.exports = { getBestMove };
