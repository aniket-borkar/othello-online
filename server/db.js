'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'othello.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    oauth_provider TEXT NOT NULL DEFAULT 'discord',
    oauth_id TEXT NOT NULL,
    elo INTEGER NOT NULL DEFAULT 1200,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(oauth_provider, oauth_id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    black_user_id INTEGER NOT NULL,
    white_user_id INTEGER NOT NULL,
    winner_user_id INTEGER,
    black_score INTEGER NOT NULL,
    white_score INTEGER NOT NULL,
    black_elo_before INTEGER NOT NULL,
    white_elo_before INTEGER NOT NULL,
    black_elo_after INTEGER NOT NULL,
    white_elo_after INTEGER NOT NULL,
    move_history TEXT NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('black','white','draw')),
    ended_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_games_black_user_id ON games(black_user_id);
  CREATE INDEX IF NOT EXISTS idx_games_white_user_id ON games(white_user_id);
  CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);
`);

// Prepared statements
const stmtGetUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtGetUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const stmtGetUserByOAuth = db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?');
const stmtCreateOAuthUser = db.prepare(
  'INSERT INTO users (username, oauth_provider, oauth_id) VALUES (?, ?, ?)'
);
const stmtUpdateUserElo = db.prepare(
  'UPDATE users SET elo = ? WHERE id = ?'
);
const stmtUpdateUserStats = db.prepare(
  'UPDATE users SET games_played = games_played + 1, wins = wins + ?, losses = losses + ?, draws = draws + ? WHERE id = ?'
);
const stmtRecordGame = db.prepare(`
  INSERT INTO games (black_user_id, white_user_id, winner_user_id, black_score, white_score,
    black_elo_before, white_elo_before, black_elo_after, white_elo_after, move_history, result)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetLeaderboard = db.prepare(
  'SELECT id, username, elo, games_played, wins, losses, draws FROM users ORDER BY elo DESC LIMIT ?'
);
const stmtGetUserStats = db.prepare(`
  SELECT u.id, u.username, u.elo, u.games_played, u.wins, u.losses, u.draws,
    (SELECT COUNT(*) FROM games g WHERE (g.black_user_id = u.id OR g.white_user_id = u.id)) AS total_games
  FROM users u WHERE u.id = ?
`);

function getUserById(id) {
  return stmtGetUserById.get(id) || null;
}

function getUserByUsername(username) {
  return stmtGetUserByUsername.get(username) || null;
}

function getUserByOAuth(provider, oauthId) {
  return stmtGetUserByOAuth.get(provider, oauthId) || null;
}

function createOAuthUser(username, provider, oauthId) {
  const info = stmtCreateOAuthUser.run(username, provider, oauthId);
  return info.lastInsertRowid;
}

function updateUserElo(userId, newElo) {
  stmtUpdateUserElo.run(newElo, userId);
}

function updateUserStats(userId, win, loss, draw) {
  stmtUpdateUserStats.run(win ? 1 : 0, loss ? 1 : 0, draw ? 1 : 0, userId);
}

function recordGame(data) {
  const info = stmtRecordGame.run(
    data.blackUserId,
    data.whiteUserId,
    data.winnerUserId,
    data.blackScore,
    data.whiteScore,
    data.blackEloBefore,
    data.whiteEloBefore,
    data.blackEloAfter,
    data.whiteEloAfter,
    data.moveHistory,
    data.result
  );
  return info.lastInsertRowid;
}

function getLeaderboard(limit = 20) {
  return stmtGetLeaderboard.all(limit);
}

function getUserStats(userId) {
  return stmtGetUserStats.get(userId) || null;
}

module.exports = {
  db,
  getUserById,
  getUserByUsername,
  getUserByOAuth,
  createOAuthUser,
  updateUserElo,
  updateUserStats,
  recordGame,
  getLeaderboard,
  getUserStats,
};
