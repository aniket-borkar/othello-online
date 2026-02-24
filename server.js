'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const auth = require('./server/auth');
const { registerHandlers } = require('./server/socket-handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

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
