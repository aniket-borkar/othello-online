'use strict';

const crypto = require('crypto');
const db = require('./db');

const sessions = new Map();

function _createSession(user) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    elo: user.elo,
    createdAt: Date.now(),
  });
  return sessionId;
}

function _userResponse(user) {
  return {
    id: user.id,
    username: user.username,
    elo: user.elo,
    gamesPlayed: user.games_played,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  };
}

function findOrCreateOAuthUser(provider, oauthId, displayName) {
  // Try to find existing user by OAuth ID
  let user = db.getUserByOAuth(provider, oauthId);
  if (user) {
    const sessionId = _createSession(user);
    return { ok: true, sessionId, user: _userResponse(user) };
  }

  // Create new user with a generated username
  let baseUsername = (displayName || 'Player')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .substring(0, 15);
  if (baseUsername.length < 3) {
    baseUsername = 'Player';
  }

  let username = baseUsername;
  while (db.getUserByUsername(username)) {
    const suffix = crypto.randomInt(1000, 9999);
    username = `${baseUsername}${suffix}`;
    if (username.length > 20) {
      username = `${baseUsername.substring(0, 15)}${suffix}`;
    }
  }

  const userId = db.createOAuthUser(username, provider, oauthId);
  user = db.getUserById(userId);

  const sessionId = _createSession(user);
  return { ok: true, sessionId, user: _userResponse(user) };
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = { findOrCreateOAuthUser, getSession, destroySession };
