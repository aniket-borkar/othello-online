'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const BCRYPT_COST = 10;
const sessions = new Map();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

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

function register(username, email, password) {
  // Validate username
  if (!username || typeof username !== 'string') {
    return { ok: false, error: 'Username is required.' };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { ok: false, error: 'Username must be 3-20 characters, alphanumeric and underscores only.' };
  }

  // Validate email
  if (!email || typeof email !== 'string') {
    return { ok: false, error: 'Email is required.' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Invalid email format.' };
  }

  // Validate password
  if (!password || typeof password !== 'string') {
    return { ok: false, error: 'Password is required.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  // Check if username is taken
  const existingUsername = db.getUserByUsername(username);
  if (existingUsername) {
    return { ok: false, error: 'Username is already taken.' };
  }

  // Check if email is taken
  const existingEmail = db.getUserByEmail(email);
  if (existingEmail) {
    return { ok: false, error: 'Email is already registered.' };
  }

  // Hash password and create user
  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const userId = db.createUser(username, email, passwordHash);
  const user = db.getUserById(userId);

  // Create session
  const sessionId = _createSession(user);

  return {
    ok: true,
    sessionId,
    user: _userResponse(user),
  };
}

function login(identifier, password) {
  // Validate inputs
  if (!identifier || typeof identifier !== 'string') {
    return { ok: false, error: 'Username or email is required.' };
  }
  if (!password || typeof password !== 'string') {
    return { ok: false, error: 'Password is required.' };
  }

  // Look up user by username first, then by email
  let user = db.getUserByUsername(identifier);
  if (!user) {
    user = db.getUserByEmail(identifier);
  }
  if (!user) {
    return { ok: false, error: 'Invalid username/email or password.' };
  }

  // If user has no password (SSO-only account), they cannot log in with password
  if (!user.password_hash) {
    return { ok: false, error: 'Please log in with Google/Discord.' };
  }

  // Compare password
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return { ok: false, error: 'Invalid username/email or password.' };
  }

  // Create session
  const sessionId = _createSession(user);

  return {
    ok: true,
    sessionId,
    user: _userResponse(user),
  };
}

function findOrCreateOAuthUser(provider, oauthId, email, displayName) {
  // 1. Try to find existing OAuth user
  let user = db.getUserByOAuth(provider, oauthId);
  if (user) {
    const sessionId = _createSession(user);
    return { ok: true, sessionId, user: _userResponse(user) };
  }

  // 2. If email provided, try to find existing user by email and link OAuth
  if (email) {
    user = db.getUserByEmail(email);
    if (user) {
      db.linkOAuth(user.id, provider, oauthId);
      user = db.getUserById(user.id); // Refresh after linking
      const sessionId = _createSession(user);
      return { ok: true, sessionId, user: _userResponse(user) };
    }
  }

  // 3. Create new user with a generated username
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
    // Ensure total length stays within 20 chars
    if (username.length > 20) {
      username = `${baseUsername.substring(0, 15)}${suffix}`;
    }
  }

  const userId = db.createOAuthUser(username, email, provider, oauthId);
  user = db.getUserById(userId);

  const sessionId = _createSession(user);
  return { ok: true, sessionId, user: _userResponse(user) };
}

function generateResetToken(email) {
  if (!email || typeof email !== 'string') {
    return { ok: false, error: 'Email is required.' };
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'No account found with that email.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.createResetToken(user.id, token, expiresAt);

  return { ok: true, token };
}

function resetPassword(token, newPassword) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Reset token is required.' };
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return { ok: false, error: 'New password is required.' };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  const resetToken = db.getResetToken(token);
  if (!resetToken) {
    return { ok: false, error: 'Invalid or already used reset token.' };
  }

  // Check expiry
  if (new Date(resetToken.expires_at) < new Date()) {
    return { ok: false, error: 'Reset token has expired.' };
  }

  // Hash new password and update user
  const passwordHash = bcrypt.hashSync(newPassword, BCRYPT_COST);
  db.updateUserPassword(resetToken.user_id, passwordHash);
  db.markTokenUsed(resetToken.id);

  return { ok: true, message: 'Password has been reset successfully.' };
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = { register, login, findOrCreateOAuthUser, generateResetToken, resetPassword, getSession, destroySession };
