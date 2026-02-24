'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const auth = require('./server/auth');
const oauth = require('./server/oauth');
const email = require('./server/email');
const { registerHandlers } = require('./server/socket-handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// --- REST Routes ---

app.post('/api/register', (req, res) => {
  const { username, email: userEmail, password } = req.body;
  const result = auth.register(username, userEmail, password);
  if (result.ok) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body;
  // Fall back to username field for backwards compat
  const id = identifier || req.body.username;
  const result = auth.login(id, password);
  if (result.ok) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email: userEmail } = req.body;
  const result = auth.generateResetToken(userEmail);
  if (!result.ok) return res.status(400).json(result);
  try {
    await email.sendResetEmail(userEmail, result.token);
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Failed to send reset email:', err);
    res.status(500).json({ ok: false, error: 'Failed to send email.' });
  }
});

app.post('/api/reset-password', (req, res) => {
  const { token, password } = req.body;
  const result = auth.resetPassword(token, password);
  if (result.ok) res.json(result);
  else res.status(400).json(result);
});

// --- OAuth Routes ---

app.get('/auth/google', (req, res) => {
  if (!oauth.isGoogleConfigured()) return res.status(503).send('Google SSO not configured.');
  res.redirect(oauth.getGoogleAuthUrl());
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=missing_code');
    const profile = await oauth.handleGoogleCallback(code);
    const result = auth.findOrCreateOAuthUser('google', profile.oauthId, profile.email, profile.name);
    if (!result.ok) return res.redirect('/?error=auth_failed');
    res.redirect(`/?sessionId=${result.sessionId}&userId=${result.user.id}&username=${encodeURIComponent(result.user.username)}&elo=${result.user.elo}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect('/?error=oauth_failed');
  }
});

app.get('/auth/discord', (req, res) => {
  if (!oauth.isDiscordConfigured()) return res.status(503).send('Discord SSO not configured.');
  res.redirect(oauth.getDiscordAuthUrl());
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=missing_code');
    const profile = await oauth.handleDiscordCallback(code);
    const result = auth.findOrCreateOAuthUser('discord', profile.oauthId, profile.email, profile.name);
    if (!result.ok) return res.redirect('/?error=auth_failed');
    res.redirect(`/?sessionId=${result.sessionId}&userId=${result.user.id}&username=${encodeURIComponent(result.user.username)}&elo=${result.user.elo}`);
  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.redirect('/?error=oauth_failed');
  }
});

app.get('/api/auth-config', (req, res) => {
  res.json({
    google: oauth.isGoogleConfigured(),
    discord: oauth.isDiscordConfigured(),
  });
});

// --- Discord Activity Endpoints ---

app.get('/api/discord-config', (req, res) => {
  res.json({ clientId: process.env.DISCORD_CLIENT_ID || '' });
});

app.post('/api/token', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return res.status(503).json({ error: 'Discord not configured.' });
    }

    // Exchange code for access_token with Discord
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Discord token exchange failed:', tokenData);
      return res.status(400).json({ error: 'Token exchange failed.' });
    }

    // Fetch the Discord user profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    // Find or create the user in our app database
    const result = auth.findOrCreateOAuthUser(
      'discord',
      String(discordUser.id),
      discordUser.email || null,
      discordUser.global_name || discordUser.username || 'Player'
    );

    if (!result.ok) {
      return res.status(500).json({ error: 'Failed to create app user.' });
    }

    res.json({
      access_token: tokenData.access_token,
      sessionId: result.sessionId,
      user: result.user,
    });
  } catch (err) {
    console.error('POST /api/token error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- Socket.IO ---

registerHandlers(io);

// --- Start Server ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Othello server running on http://localhost:${PORT}`);
});
