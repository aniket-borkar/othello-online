'use strict';

const crypto = require('crypto');
const {
  EMPTY, BLACK, WHITE,
  getFlips, getValidMoves, applyMove, countDiscs, isGameOver,
} = require('./game-engine');
const { calculateNewRatings } = require('./elo');
const db = require('./db');

// Active games: gameId -> game state
const games = new Map();

// userId -> gameId lookup for quick access
const userGameMap = new Map();

// Disconnect timers: gameId:userId -> timeout handle
const disconnectTimers = new Map();

function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

/**
 * Create a new active game between two players.
 * @param {object} blackPlayer - { userId, username, elo, socketId }
 * @param {object} whitePlayer - { userId, username, elo, socketId }
 * @returns {object} The game state
 */
function createGame(blackPlayer, whitePlayer) {
  const gameId = crypto.randomUUID();
  const game = {
    gameId,
    board: createInitialBoard(),
    currentPlayer: BLACK,
    players: {
      [BLACK]: {
        userId: blackPlayer.userId,
        username: blackPlayer.username,
        socketId: blackPlayer.socketId,
      },
      [WHITE]: {
        userId: whitePlayer.userId,
        username: whitePlayer.username,
        socketId: whitePlayer.socketId,
      },
    },
    elo: {
      [BLACK]: blackPlayer.elo,
      [WHITE]: whitePlayer.elo,
    },
    moveHistory: [],
    status: 'active',
    startedAt: Date.now(),
  };

  games.set(gameId, game);
  userGameMap.set(blackPlayer.userId, gameId);
  userGameMap.set(whitePlayer.userId, gameId);

  return game;
}

/**
 * Make a move in a game.
 * @returns {object} Result with ok flag and game state or error
 */
function makeMove(gameId, userId, row, col) {
  const game = games.get(gameId);
  if (!game) {
    return { ok: false, error: 'Game not found.' };
  }
  if (game.status !== 'active') {
    return { ok: false, error: 'Game is not active.' };
  }

  // Determine which color the user is playing
  let playerColor = null;
  if (game.players[BLACK].userId === userId) playerColor = BLACK;
  else if (game.players[WHITE].userId === userId) playerColor = WHITE;
  else return { ok: false, error: 'You are not in this game.' };

  // Check if it's the player's turn
  if (game.currentPlayer !== playerColor) {
    return { ok: false, error: 'It is not your turn.' };
  }

  // Validate the move
  const flips = getFlips(game.board, row, col, playerColor);
  if (flips.length === 0) {
    return { ok: false, error: 'Invalid move.' };
  }

  // Apply the move
  const result = applyMove(game.board, row, col, playerColor);
  game.board = result.board;
  game.moveHistory.push({ player: playerColor, row, col });

  const scores = countDiscs(game.board);

  // Check game over
  if (isGameOver(game.board)) {
    let resultStr;
    if (scores.black > scores.white) resultStr = 'black';
    else if (scores.white > scores.black) resultStr = 'white';
    else resultStr = 'draw';

    const finalResult = finalizeGame(gameId, resultStr);
    return {
      ok: true,
      board: game.board,
      flips: result.flips,
      move: [row, col],
      currentPlayer: null,
      scores,
      isGameOver: true,
      result: resultStr,
      eloChanges: finalResult.eloChanges,
    };
  }

  // Advance turn
  const nextPlayer = playerColor === BLACK ? WHITE : BLACK;
  const nextMoves = getValidMoves(game.board, nextPlayer);
  let passed = false;

  if (nextMoves.length > 0) {
    game.currentPlayer = nextPlayer;
  } else {
    // Next player has no moves — check if current player can still move
    const currentMoves = getValidMoves(game.board, playerColor);
    if (currentMoves.length > 0) {
      // Current player keeps the turn; next player passes
      game.currentPlayer = playerColor;
      passed = true;
    }
    // If neither can move, isGameOver would have caught it above
  }

  return {
    ok: true,
    board: game.board,
    flips: result.flips,
    move: [row, col],
    currentPlayer: game.currentPlayer,
    scores,
    isGameOver: false,
    result: null,
    passed,
    passedPlayer: passed ? nextPlayer : null,
  };
}

function getGame(gameId) {
  return games.get(gameId) || null;
}

function getGameByUserId(userId) {
  const gameId = userGameMap.get(userId);
  if (!gameId) return null;
  return games.get(gameId) || null;
}

/**
 * Handle a player disconnecting from a game. Starts a 60s forfeit timer.
 */
function handleDisconnect(gameId, userId) {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') return;

  const timerKey = `${gameId}:${userId}`;
  if (disconnectTimers.has(timerKey)) return;

  const timer = setTimeout(() => {
    disconnectTimers.delete(timerKey);
    const g = games.get(gameId);
    if (!g || g.status !== 'active') return;

    // Forfeit: the disconnected player loses
    let result;
    if (g.players[BLACK].userId === userId) {
      result = 'white';
    } else {
      result = 'black';
    }
    finalizeGame(gameId, result);
  }, 60000);

  disconnectTimers.set(timerKey, timer);
}

/**
 * Handle a player reconnecting to a game. Clears the forfeit timer.
 */
function handleReconnect(gameId, userId, newSocketId) {
  const game = games.get(gameId);
  if (!game) return null;

  // Update socket ID
  if (game.players[BLACK].userId === userId) {
    game.players[BLACK].socketId = newSocketId;
  } else if (game.players[WHITE].userId === userId) {
    game.players[WHITE].socketId = newSocketId;
  }

  // Clear disconnect timer
  const timerKey = `${gameId}:${userId}`;
  const timer = disconnectTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(timerKey);
  }

  return game;
}

/**
 * Handle a player resigning from a game.
 */
function handleResign(gameId, userId) {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') {
    return { ok: false, error: 'Game not found or not active.' };
  }

  let result;
  if (game.players[BLACK].userId === userId) {
    result = 'white';
  } else if (game.players[WHITE].userId === userId) {
    result = 'black';
  } else {
    return { ok: false, error: 'You are not in this game.' };
  }

  const finalResult = finalizeGame(gameId, result);
  return { ok: true, result, eloChanges: finalResult.eloChanges };
}

/**
 * Finalize a game: compute ELO changes, update DB, clean up.
 * @param {string} result - 'black', 'white', or 'draw'
 */
function finalizeGame(gameId, result) {
  const game = games.get(gameId);
  if (!game) return { ok: false };

  game.status = 'finished';

  const blackUserId = game.players[BLACK].userId;
  const whiteUserId = game.players[WHITE].userId;
  const blackElo = game.elo[BLACK];
  const whiteElo = game.elo[WHITE];

  // Determine ELO score for black
  let scoreA; // scoreA is from black's perspective
  if (result === 'black') scoreA = 1;
  else if (result === 'white') scoreA = 0;
  else scoreA = 0.5;

  const { newA: newBlackElo, newB: newWhiteElo } = calculateNewRatings(blackElo, whiteElo, scoreA);

  // Update ELO in DB
  db.updateUserElo(blackUserId, newBlackElo);
  db.updateUserElo(whiteUserId, newWhiteElo);

  // Update stats
  if (result === 'black') {
    db.updateUserStats(blackUserId, true, false, false);
    db.updateUserStats(whiteUserId, false, true, false);
  } else if (result === 'white') {
    db.updateUserStats(blackUserId, false, true, false);
    db.updateUserStats(whiteUserId, true, false, false);
  } else {
    db.updateUserStats(blackUserId, false, false, true);
    db.updateUserStats(whiteUserId, false, false, true);
  }

  // Record game
  const scores = countDiscs(game.board);
  const winnerUserId = result === 'black' ? blackUserId : result === 'white' ? whiteUserId : null;

  db.recordGame({
    blackUserId,
    whiteUserId,
    winnerUserId,
    blackScore: scores.black,
    whiteScore: scores.white,
    blackEloBefore: blackElo,
    whiteEloBefore: whiteElo,
    blackEloAfter: newBlackElo,
    whiteEloAfter: newWhiteElo,
    moveHistory: JSON.stringify(game.moveHistory),
    result,
  });

  // Clean up
  const eloChanges = {
    black: { before: blackElo, after: newBlackElo, diff: newBlackElo - blackElo },
    white: { before: whiteElo, after: newWhiteElo, diff: newWhiteElo - whiteElo },
  };

  // Clear disconnect timers
  for (const key of disconnectTimers.keys()) {
    if (key.startsWith(gameId)) {
      clearTimeout(disconnectTimers.get(key));
      disconnectTimers.delete(key);
    }
  }

  // Remove from user-game map
  userGameMap.delete(blackUserId);
  userGameMap.delete(whiteUserId);

  // Remove game after a delay (so clients can still read final state)
  setTimeout(() => {
    games.delete(gameId);
  }, 30000);

  return { ok: true, eloChanges, scores };
}

module.exports = {
  createGame,
  makeMove,
  getGame,
  getGameByUserId,
  handleDisconnect,
  handleReconnect,
  handleResign,
  finalizeGame,
};
